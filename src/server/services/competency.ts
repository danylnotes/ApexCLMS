import { translated } from "@/lib/status";
import type { AssessmentMethod } from "@prisma/client";
import { z } from "zod";
import { contentAccess, courseAudienceWhere } from "./access";
import { prisma } from "../db";
import { forbidden, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertCan, assertCanManageEmployee, assertCanViewEmployee } from "../policy";
import { audit } from "../audit";
import { notify } from "../notify";
import { recordActivity } from "./activity";
import { addMonths, evaluateCompetency, summarizeGaps, type CompetencyEvaluation } from "@/lib/domain/competency";

export const METHOD_LABEL: Record<AssessmentMethod, string>= translated({
  COURSE_COMPLETION: "Course completion",
  KNOWLEDGE_ASSESSMENT: "Knowledge assessment",
  PRACTICAL_DEMONSTRATION: "Practical demonstration",
  SUPERVISOR_EVALUATION: "Supervisor evaluation",
  WORKPLACE_OBSERVATION: "Workplace observation",
  VERIFIED_QUALIFICATION: "Verified qualification",
  FORMAL_ASSESSMENT: "Formal competency assessment",
}) as Record<AssessmentMethod, string>;

export const basisFor = (m: AssessmentMethod) => (m === "COURSE_COMPLETION" || m === "KNOWLEDGE_ASSESSMENT" ? "KNOWLEDGE" : "DEMONSTRATED");

export interface CompetencyRow {
  competency: { id: string; code: string; name: string; description: string; domain: string; framework: string; reassessmentMonths: number | null };
  requiredLevel: number | null;
  isCritical: boolean;
  evaluation: CompetencyEvaluation | null;
  current: {
    id: string;
    level: number;
    method: AssessmentMethod;
    basis: "KNOWLEDGE" | "DEMONSTRATED";
    assessedAt: Date;
    assessor: string | null;
    reassessmentDue: Date | null;
    notes: string | null;
    evidence: { id: string; kind: AssessmentMethod; description: string; reference: string | null; fileId: string | null }[];
  } | null;
  recommended: { slug: string; title: string; code: string; targetLevel: number }[];
  levelNames: Record<number, string>;
}

async function currentAssessments(userId: string) {
  return prisma.competencyAssessment.findMany({
    where: { userId, status: "CURRENT" },
    include: { assessor: { select: { name: true } }, evidence: true },
    orderBy: { assessedAt: "desc" },
  });
}

/** Builds a competency profile against a job role (current or target). */
export async function buildProfile(userId: string, jobRoleId: string | null, now = new Date()) {
  const access = await contentAccess(userId);
  const [requirements, current] = await Promise.all([
    jobRoleId
      ? prisma.roleCompetencyRequirement.findMany({
          where: { jobRoleId, competency: { isActive: true } },
          include: { competency: { include: { domain: { include: { framework: { include: { levels: true } } } }, courses: { where: { course: courseAudienceWhere(access) }, include: { course: true } } } } },
        })
      : Promise.resolve([]),
    currentAssessments(userId),
  ]);
  const byComp = new Map<string, (typeof current)[number]>();
  for (const a of current) if (!byComp.has(a.competencyId)) byComp.set(a.competencyId, a);

  const rows: CompetencyRow[] = requirements.map((req) => {
    const c = req.competency;
    const fw = c.domain.framework;
    const a = byComp.get(c.id) ?? null;
    const evaluation = evaluateCompetency(req.requiredLevel, a ? { level: a.level, basis: a.basis, assessedAt: a.assessedAt, reassessmentDue: a.reassessmentDue } : null, { allowKnowledgeAsCompetence: fw.allowCourseCompletionAsCompetence, now });
    return {
      competency: { id: c.id, code: c.code, name: c.name, description: c.description, domain: c.domain.name, framework: fw.name, reassessmentMonths: c.reassessmentMonths },
      requiredLevel: req.requiredLevel,
      isCritical: req.isCritical,
      evaluation,
      current: a ? { id: a.id, level: a.level, method: a.method, basis: a.basis, assessedAt: a.assessedAt, assessor: a.assessor?.name ?? null, reassessmentDue: a.reassessmentDue, notes: a.notes, evidence: a.evidence.map((e) => ({ id: e.id, kind: e.kind, description: e.description, reference: e.reference, fileId: e.fileId })) } : null,
      recommended:
        evaluation.status === "MET"
          ? []
          : c.courses.filter((cc) => cc.course.status === "PUBLISHED").sort((x, y) => y.targetLevel - x.targetLevel).slice(0, 3).map((cc) => ({ slug: cc.course.slug, title: cc.course.title, code: cc.course.code, targetLevel: cc.targetLevel })),
      levelNames: Object.fromEntries(fw.levels.map((l) => [l.level, l.name])),
    };
  });
  rows.sort((a, b) => (b.evaluation?.gap ?? 0) - (a.evaluation?.gap ?? 0) || a.competency.domain.localeCompare(b.competency.domain));
  const summary = summarizeGaps(rows.map((r) => r.evaluation!).filter(Boolean));
  const requiredIds = new Set(requirements.map((r) => r.competencyId));
  const additional = current.filter((a) => !requiredIds.has(a.competencyId));
  return { rows, summary, additional, lastAssessedAt: current[0]?.assessedAt ?? null };
}

export async function competencyProfileFor(actor: Actor, userId: string) {
  await assertCanViewEmployee(actor, userId);
  const profile = await prisma.userProfile.findUnique({ where: { userId }, include: { jobRole: true, targetJobRole: true } });
  const [current, target] = await Promise.all([
    buildProfile(userId, profile?.jobRoleId ?? null),
    profile?.targetJobRoleId ? buildProfile(userId, profile.targetJobRoleId) : Promise.resolve(null),
  ]);
  const additionalComps = await prisma.competency.findMany({ where: { id: { in: current.additional.map((a) => a.competencyId) } }, include: { domain: true } });
  return { profile, current, target, additionalComps };
}

export const assessmentInputSchema = z.object({
  userId: z.string(),
  competencyId: z.string(),
  level: z.coerce.number().int().min(1).max(10),
  method: z.enum(["KNOWLEDGE_ASSESSMENT", "PRACTICAL_DEMONSTRATION", "SUPERVISOR_EVALUATION", "WORKPLACE_OBSERVATION", "VERIFIED_QUALIFICATION", "FORMAL_ASSESSMENT"]),
  notes: z.string().trim().max(4000).optional().default(""),
  evidenceDescription: z.string().trim().min(5, "Describe the evidence assessed").max(1000),
  evidenceReference: z.string().trim().max(300).optional().default(""),
  requestId: z.string().optional().nullable(),
});

/** Records a new assessment. The previous current assessment is superseded (never overwritten). */
export async function recordAssessment(actor: Actor, raw: unknown, fileId: string | null = null) {
  const input = assessmentInputSchema.parse(raw);
  if (input.userId === actor.id) throw forbidden("You cannot assess your own competence.");
  await assertCanManageEmployee(actor, input.userId, "competency.assess");
  const comp = await prisma.competency.findUnique({ where: { id: input.competencyId }, include: { domain: { include: { framework: { include: { levels: true } } } } } });
  if (!comp) throw notFound("Competency");
  if (!comp.domain.framework.levels.some((l) => l.level === input.level)) throw invalid("The level is not defined in this framework.");
  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const prev = await tx.competencyAssessment.findMany({ where: { userId: input.userId, competencyId: input.competencyId, status: "CURRENT" } });
    for (const p of prev) {
      await tx.competencyAssessment.update({ where: { id: p.id }, data: { status: "SUPERSEDED" } });
      await tx.competencyAssessmentHistory.create({ data: { assessmentId: p.id, action: "superseded", fromStatus: "CURRENT", toStatus: "SUPERSEDED", actorId: actor.id } });
    }
    const a = await tx.competencyAssessment.create({
      data: {
        userId: input.userId,
        competencyId: input.competencyId,
        level: input.level,
        method: input.method,
        basis: basisFor(input.method),
        assessedAt: now,
        assessorId: actor.id,
        reassessmentDue: comp.reassessmentMonths ? addMonths(now, comp.reassessmentMonths) : null,
        notes: input.notes || null,
        evidence: { create: { kind: input.method, description: input.evidenceDescription, reference: input.evidenceReference || null, fileId } },
      },
    });
    await tx.competencyAssessmentHistory.create({ data: { assessmentId: a.id, action: "created", toStatus: "CURRENT", actorId: actor.id } });
    if (input.requestId) {
      const r = await tx.competencyReviewRequest.updateMany({ where: { id: input.requestId, userId: input.userId, status: "PENDING" }, data: { status: "ASSESSED", reviewerId: actor.id, reviewedAt: now, assessmentId: a.id } });
      if (r.count !== 1) throw invalid("The review request is no longer pending.");
    }
    const levelName = comp.domain.framework.levels.find((l) => l.level === input.level)?.name;
    await recordActivity(input.userId, "COMPETENCY_ASSESSED", `${comp.name} assessed at level ${input.level} (${levelName}) — ${METHOD_LABEL[input.method].toLowerCase()}`, { type: "competency_assessment", id: a.id }, undefined, tx);
    await audit(actor.id, "competency.assess", "competency_assessment", a.id, { userId: input.userId, competencyId: comp.id, level: input.level }, tx);
    return a;
  });
  await notify(input.userId, {
    type: "COMPETENCY_REVIEW",
    title: "Competency assessment recorded",
    body: `${comp.name} has been assessed at level ${input.level}.`,
    link: "/competencies",
    dedupeKey: `competency-assessment:${created.id}`,
  });
  return created;
}

export const reviewRequestSchema = z.object({
  competencyId: z.string(),
  requestedLevel: z.coerce.number().int().min(1).max(10),
  statement: z.string().trim().min(30, "Explain how your evidence demonstrates the competency (30+ characters)").max(4000),
});

export async function requestReview(actor: Actor, raw: unknown, fileId: string | null) {
  assertCan(actor, "learning.self");
  const input = reviewRequestSchema.parse(raw);
  const pending = await prisma.competencyReviewRequest.findFirst({ where: { userId: actor.id, competencyId: input.competencyId, status: "PENDING" } });
  if (pending) throw invalid("You already have a pending review request for this competency.");
  const comp = await prisma.competency.findUnique({ where: { id: input.competencyId } });
  if (!comp) throw notFound("Competency");
  const r = await prisma.competencyReviewRequest.create({ data: { userId: actor.id, competencyId: input.competencyId, requestedLevel: input.requestedLevel, statement: input.statement, fileId } });
  const managers = await prisma.managerRelationship.findMany({ where: { employeeId: actor.id, type: "LINE", endDate: null } });
  for (const m of managers) {
    await notify(m.managerId, {
      type: "COMPETENCY_REVIEW",
      title: "Competency review requested",
      body: `${actor.name} has submitted evidence for ${comp.name} (level ${input.requestedLevel}).`,
      link: `/manager/team/${actor.id}?tab=competency`,
      dedupeKey: `competency-request:${r.id}`,
    });
  }
  return r;
}

export async function declineRequest(actor: Actor, requestId: string, note: string) {
  const r = await prisma.competencyReviewRequest.findUnique({ where: { id: requestId } });
  if (!r || r.status !== "PENDING") throw notFound("Review request");
  await assertCanManageEmployee(actor, r.userId, "competency.assess");
  if (!note.trim()) throw invalid("Provide a reason so the employee can strengthen their evidence.");
  await prisma.competencyReviewRequest.update({ where: { id: r.id }, data: { status: "DECLINED", reviewerId: actor.id, reviewedAt: new Date(), reviewNote: note.trim() } });
  await audit(actor.id, "competency.request.decline", "competency_review_request", r.id);
  await notify(r.userId, { type: "COMPETENCY_REVIEW", title: "Competency review outcome", body: `Your review request was not assessed: ${note.trim()}`, link: "/competencies", dedupeKey: `competency-request-decline:${r.id}` });
}
