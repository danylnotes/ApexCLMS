import type { PlanStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { forbidden, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertCan, assertCanViewEmployee, can, reportingScope } from "../policy";
import { audit } from "../audit";
import { notify } from "../notify";
import { recordActivity } from "./activity";
import { currentPeriod } from "./periods";
import { checkPlanTransition, ownerCanEdit, PLAN_STATUS_LABEL, type PlanActor } from "@/lib/domain/plan";

const planInclude = {
  objectives: { orderBy: { sortOrder: "asc" }, include: { competency: true, actions: { include: { course: { select: { slug: true, title: true } }, webinar: { select: { slug: true, title: true } } } } } },
  reviews: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
  comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
  user: { select: { id: true, name: true, profile: { include: { jobRole: true, department: true } } } },
  reviewer: { select: { id: true, name: true } },
  targetJobRole: true,
  period: true,
} satisfies Prisma.DevelopmentPlanInclude;

export type PlanDetail = Prisma.DevelopmentPlanGetPayload<{ include: typeof planInclude }>;

async function roleFor(actor: Actor, plan: { userId: string; reviewerId: string | null }): Promise<PlanActor | "VIEWER"> {
  if (plan.userId === actor.id) return "OWNER";
  if (can(actor, "plan.review")) {
    if (plan.reviewerId === actor.id) return "REVIEWER";
    if ((await reportingScope(actor.id)).includes(plan.userId)) return "REVIEWER";
  }
  return "VIEWER";
}

export async function getPlan(actor: Actor, planId: string) {
  const plan = await prisma.developmentPlan.findUnique({ where: { id: planId }, include: planInclude });
  if (!plan) throw notFound("Development plan");
  await assertCanViewEmployee(actor, plan.userId);
  return { plan, role: await roleFor(actor, plan) };
}

export async function plansFor(actor: Actor, userId: string) {
  await assertCanViewEmployee(actor, userId);
  return prisma.developmentPlan.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: planInclude });
}

export const planCreateSchema = z.object({
  title: z.string().trim().min(4).max(200),
  careerAspiration: z.string().trim().max(2000).optional().default(""),
  targetJobRoleId: z.string().optional().nullable(),
});

export async function createPlan(actor: Actor, raw: unknown) {
  assertCan(actor, "learning.self");
  const input = planCreateSchema.parse(raw);
  const open = await prisma.developmentPlan.count({ where: { userId: actor.id, status: { not: "COMPLETED" } } });
  if (open) throw invalid("You already have an open development plan. Complete it before starting another.");
  const [period, manager] = await Promise.all([
    currentPeriod(),
    prisma.managerRelationship.findFirst({ where: { employeeId: actor.id, type: "LINE", endDate: null } }),
  ]);
  const plan = await prisma.developmentPlan.create({
    data: { userId: actor.id, reviewerId: manager?.managerId ?? null, periodId: period?.id, title: input.title, careerAspiration: input.careerAspiration || null, targetJobRoleId: input.targetJobRoleId || null },
  });
  if (input.targetJobRoleId) await prisma.userProfile.update({ where: { userId: actor.id }, data: { targetJobRoleId: input.targetJobRoleId } }).catch(() => undefined);
  return plan;
}

export const objectiveSchema = z.object({
  goal: z.string().trim().min(5, "Describe the development goal").max(500),
  currentCapability: z.string().trim().max(1000).optional().default(""),
  targetCapability: z.string().trim().max(1000).optional().default(""),
  competencyId: z.string().optional().nullable(),
  competencyGap: z.string().trim().max(1000).optional().default(""),
  workplaceApplication: z.string().trim().max(1000).optional().default(""),
  supportingEvidence: z.string().trim().max(1000).optional().default(""),
  responsible: z.string().trim().max(200).optional().default(""),
  learningModel: z.enum(["EXPERIENTIAL", "SOCIAL", "FORMAL"]).optional().nullable(),
  targetDate: z.coerce.date().optional().nullable(),
  reviewDate: z.coerce.date().optional().nullable(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DEFERRED"]).optional(),
});

const blank = (s?: string | null) => (s && s.trim() ? s.trim() : null);

export async function upsertObjective(actor: Actor, planId: string, objectiveId: string | null, raw: unknown) {
  const { plan, role } = await getPlan(actor, planId);
  const input = objectiveSchema.parse(raw);
  if (role !== "OWNER") throw forbidden("Only the plan owner can edit objectives. Managers add feedback instead.");
  if (!ownerCanEdit(plan.status) && !(plan.status === "IN_PROGRESS" && objectiveId)) {
    throw invalid(`Objectives cannot be changed while the plan is ${PLAN_STATUS_LABEL[plan.status]}. Submit a revision instead.`);
  }
  const data = {
    goal: input.goal,
    currentCapability: blank(input.currentCapability),
    targetCapability: blank(input.targetCapability),
    competencyId: input.competencyId || null,
    competencyGap: blank(input.competencyGap),
    workplaceApplication: blank(input.workplaceApplication),
    supportingEvidence: blank(input.supportingEvidence),
    responsible: blank(input.responsible),
    learningModel: input.learningModel ?? null,
    targetDate: input.targetDate ?? null,
    reviewDate: input.reviewDate ?? null,
    ...(input.status ? { status: input.status } : {}),
  };
  if (objectiveId) {
    const obj = plan.objectives.find((o) => o.id === objectiveId);
    if (!obj) throw notFound("Objective");
    // While in progress, only status and evidence may change.
    const update = plan.status === "IN_PROGRESS" ? { status: data.status, supportingEvidence: data.supportingEvidence } : data;
    return prisma.developmentObjective.update({ where: { id: objectiveId }, data: update });
  }
  return prisma.developmentObjective.create({ data: { ...data, planId, sortOrder: plan.objectives.length } });
}

export async function deleteObjective(actor: Actor, planId: string, objectiveId: string) {
  const { plan, role } = await getPlan(actor, planId);
  if (role !== "OWNER" || !ownerCanEdit(plan.status)) throw forbidden("Objectives can only be removed while the plan is in draft or employee review.");
  if (!plan.objectives.some((o) => o.id === objectiveId)) throw notFound("Objective");
  await prisma.developmentObjective.delete({ where: { id: objectiveId } });
}

export const actionSchema = z.object({
  objectiveId: z.string(),
  title: z.string().trim().min(3).max(300),
  type: z.enum(["COURSE", "WEBINAR", "ON_THE_JOB", "MENTORING", "PROJECT", "OTHER"]),
  courseId: z.string().optional().nullable(),
  webinarId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export async function addAction(actor: Actor, planId: string, raw: unknown) {
  const { plan, role } = await getPlan(actor, planId);
  const a = actionSchema.parse(raw);
  if (role !== "OWNER" || plan.status === "COMPLETED") throw forbidden();
  if (!plan.objectives.some((o) => o.id === a.objectiveId)) throw notFound("Objective");
  return prisma.developmentAction.create({ data: { objectiveId: a.objectiveId, title: a.title, type: a.type, courseId: a.courseId || null, webinarId: a.webinarId || null, dueDate: a.dueDate ?? null } });
}

export async function toggleAction(actor: Actor, planId: string, actionId: string) {
  const { plan, role } = await getPlan(actor, planId);
  if (role !== "OWNER" || plan.status === "COMPLETED") throw forbidden();
  const action = plan.objectives.flatMap((o) => o.actions).find((x) => x.id === actionId);
  if (!action) throw notFound("Action");
  return prisma.developmentAction.update({ where: { id: actionId }, data: { completedAt: action.completedAt ? null : new Date() } });
}

export async function setManagerFeedback(actor: Actor, planId: string, objectiveId: string, feedback: string) {
  const { plan, role } = await getPlan(actor, planId);
  if (role !== "REVIEWER") throw forbidden("Only the reviewing manager can record feedback.");
  if (plan.status === "COMPLETED") throw invalid("The plan is completed.");
  if (!plan.objectives.some((o) => o.id === objectiveId)) throw notFound("Objective");
  await prisma.developmentObjective.update({ where: { id: objectiveId }, data: { managerFeedback: feedback.trim() || null } });
}

export async function addComment(actor: Actor, planId: string, body: string, objectiveId?: string | null) {
  const { plan, role } = await getPlan(actor, planId);
  if (role === "VIEWER") throw forbidden();
  if (!body.trim()) throw invalid("Enter a comment.");
  if (objectiveId && !plan.objectives.some((o) => o.id === objectiveId)) throw notFound("Objective");
  return prisma.developmentComment.create({ data: { planId, objectiveId: objectiveId || null, authorId: actor.id, body: body.trim().slice(0, 4000) } });
}

/** Workflow transition with a full snapshot recorded for revision history. */
export async function transitionPlan(actor: Actor, planId: string, to: PlanStatus, comment?: string | null) {
  const { plan, role } = await getPlan(actor, planId);
  if (role === "VIEWER") throw forbidden();
  const err = checkPlanTransition(plan.status, to, role, { comment, objectives: plan.objectives.length });
  if (err) throw invalid(err);
  const now = new Date();
  const snapshot = {
    title: plan.title,
    careerAspiration: plan.careerAspiration,
    targetJobRole: plan.targetJobRole?.title ?? null,
    objectives: plan.objectives.map((o) => ({ goal: o.goal, currentCapability: o.currentCapability, targetCapability: o.targetCapability, competency: o.competency?.name ?? null, learningModel: o.learningModel, targetDate: o.targetDate, status: o.status, managerFeedback: o.managerFeedback })),
  };
  const bumpVersion = to === "DRAFT" || (plan.status === "IN_PROGRESS" && to === "MANAGER_REVIEW");
  await prisma.$transaction(async (tx) => {
    const r = await tx.developmentPlan.updateMany({
      where: { id: plan.id, status: plan.status },
      data: {
        status: to,
        version: bumpVersion ? plan.version + 1 : plan.version,
        agreedAt: to === "AGREED" ? now : plan.agreedAt,
        lastReviewedAt: role === "REVIEWER" ? now : plan.lastReviewedAt,
        reviewerId: plan.reviewerId ?? (role === "REVIEWER" ? actor.id : null),
      },
    });
    if (r.count !== 1) throw invalid("The plan was updated by someone else. Refresh and try again.");
    await tx.developmentReview.create({
      data: { planId: plan.id, actorId: actor.id, fromStatus: plan.status, toStatus: to, decision: `${PLAN_STATUS_LABEL[plan.status]} → ${PLAN_STATUS_LABEL[to]}`, comments: comment?.trim() || null, snapshot, version: plan.version },
    });
    if (role === "REVIEWER") {
      await recordActivity(plan.userId, "PLAN_REVIEWED", `Development plan reviewed: ${PLAN_STATUS_LABEL[to]}`, { type: "development_plan", id: plan.id }, undefined, tx);
      await audit(actor.id, "plan.transition", "development_plan", plan.id, { from: plan.status, to }, tx);
    }
  });
  const recipient = role === "OWNER" ? plan.reviewerId : plan.userId;
  if (recipient) {
    await notify(recipient, {
      type: "PLAN_REVIEW",
      title: role === "OWNER" ? `Development plan ${to === "MANAGER_REVIEW" ? "submitted for review" : "updated"}` : `Development plan ${PLAN_STATUS_LABEL[to].toLowerCase()}`,
      body: `${plan.title} — ${PLAN_STATUS_LABEL[to]}${comment ? `: ${comment}` : ""}`,
      link: role === "OWNER" ? `/manager/team/${plan.userId}?tab=plan` : "/development-plan",
      dedupeKey: `plan:${plan.id}:${plan.version}:${to}:${now.getTime()}`,
    });
  }
}
