import { translated } from "@/lib/status";
import { Prisma, type CpdClaimStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { forbidden, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertCan, assertCanViewEmployee, can } from "../policy";
import { audit } from "../audit";
import { notify } from "../notify";
import { recordActivity } from "./activity";
import { assertCpdTransition, claimableValue, CpdTransitionError, summarizeCpd } from "@/lib/domain/cpd";
import { currentPeriod } from "./periods";

export const CPD_TYPE_LABEL: Record<string, string>= translated({
  INTERNAL_COURSE: "Internal course",
  EXTERNAL_TRAINING: "External training",
  TECHNICAL_SEMINAR: "Technical seminar",
  WEBINAR: "Verified webinar",
  CONFERENCE: "Professional conference",
  TECHNICAL_PRESENTATION: "Technical presentation",
  PUBLICATION: "Research or technical publication",
  MENTORING: "Professional mentoring",
  OTHER: "Other approved activity",
}) as Record<string, string>;

export const claimInputSchema = z.object({
  title: z.string().trim().min(4, "Enter an activity title").max(200),
  type: z.enum(["EXTERNAL_TRAINING", "TECHNICAL_SEMINAR", "CONFERENCE", "TECHNICAL_PRESENTATION", "PUBLICATION", "MENTORING", "OTHER"]),
  provider: z.string().trim().max(200).optional().default(""),
  activityDate: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 86_400_000, "The activity date cannot be in the future"),
  durationHours: z.coerce.number().positive("Duration must be greater than zero").max(200),
  claimedValue: z.coerce.number().positive("Claimed value must be greater than zero").max(200),
  description: z.string().trim().min(10, "Describe the activity (10+ characters)").max(4000),
  learningOutcomes: z.string().trim().min(10, "Describe what you learned (10+ characters)").max(4000),
  competencyId: z.string().optional().nullable(),
  recognition: z.enum(["COMPANY_RECORDED", "PROFESSIONAL_BODY"]).default("COMPANY_RECORDED"),
  evidenceDescription: z.string().trim().max(500).optional().default(""),
  evidenceReference: z.string().trim().max(300).optional().default(""),
  submit: z.boolean().default(false),
});

export type ClaimInput = z.infer<typeof claimInputSchema>;

async function userPolicy(userId: string) {
  const p = await prisma.userProfile.findUnique({ where: { userId }, include: { cpdPolicy: true } });
  return p?.cpdPolicy ?? null;
}

export async function createClaim(actor: Actor, raw: unknown, fileIds: string[] = []) {
  assertCan(actor, "learning.self");
  const input = claimInputSchema.parse(raw);
  const policy = await userPolicy(actor.id);
  if (policy && policy.eligibleTypes.length && !policy.eligibleTypes.includes(input.type)) {
    throw invalid(`${CPD_TYPE_LABEL[input.type]} is not an eligible activity type under ${policy.name}.`);
  }
  const maxClaim = claimableValue(input.durationHours, policy ? { unit: policy.unit, targetPerPeriod: null, pointsPerHour: policy.pointsPerHour ? Number(policy.pointsPerHour) : null, maxPerActivity: policy.maxPerActivity ? Number(policy.maxPerActivity) : null } : null);
  if (input.claimedValue > maxClaim) throw invalid(`The claimed value cannot exceed ${maxClaim} for this duration under your CPD policy.`);
  const period = await currentPeriod();
  const status: CpdClaimStatus = input.submit ? "SUBMITTED" : "DRAFT";
  const claim = await prisma.$transaction(async (tx) => {
    const activity = await tx.cpdActivity.create({
      data: {
        userId: actor.id,
        title: input.title,
        type: input.type,
        provider: input.provider || null,
        activityDate: input.activityDate,
        durationHours: input.durationHours,
        description: input.description,
        learningOutcomes: input.learningOutcomes,
        competencyId: input.competencyId || null,
      },
    });
    const c = await tx.cpdClaim.create({
      data: {
        activityId: activity.id,
        userId: actor.id,
        periodId: period?.id,
        unit: policy?.unit ?? "HOURS",
        claimedValue: input.claimedValue,
        recognition: input.recognition,
        status,
        submittedAt: input.submit ? new Date() : null,
      },
    });
    if (input.evidenceDescription || input.evidenceReference || fileIds.length) {
      const files = fileIds.length ? fileIds : [null];
      for (const fileId of files) {
        await tx.cpdEvidence.create({
          data: { claimId: c.id, description: input.evidenceDescription || "Supporting evidence", reference: input.evidenceReference || null, fileId },
        });
      }
    }
    if (input.submit) {
      await tx.cpdApproval.create({ data: { claimId: c.id, actorId: actor.id, fromStatus: "DRAFT", toStatus: "SUBMITTED" } });
      await recordActivity(actor.id, "CPD_SUBMITTED", `Submitted CPD claim: ${input.title}`, { type: "cpd_claim", id: c.id }, undefined, tx);
    }
    return c;
  });
  return claim;
}

async function loadClaim(id: string) {
  const c = await prisma.cpdClaim.findUnique({ where: { id }, include: { activity: true } });
  if (!c) throw notFound("CPD claim");
  return c;
}

function transitionError(e: unknown): never {
  if (e instanceof CpdTransitionError) throw invalid(e.message);
  throw e;
}

/** Owner actions: submit a draft, withdraw a submitted claim, or revise a rejected claim back to draft. */
export async function ownerTransition(actor: Actor, claimId: string, to: "SUBMITTED" | "DRAFT") {
  const c = await loadClaim(claimId);
  if (c.userId !== actor.id) throw notFound("CPD claim");
  try {
    assertCpdTransition(c.status, to);
  } catch (e) {
    transitionError(e);
  }
  await prisma.$transaction(async (tx) => {
    // Optimistic concurrency: only transition if the status is unchanged.
    const r = await tx.cpdClaim.updateMany({ where: { id: c.id, status: c.status }, data: { status: to, submittedAt: to === "SUBMITTED" ? new Date() : c.submittedAt, rejectionReason: to === "DRAFT" ? null : c.rejectionReason } });
    if (r.count !== 1) throw invalid("This claim was changed by someone else. Refresh and try again.");
    await tx.cpdApproval.create({ data: { claimId: c.id, actorId: actor.id, fromStatus: c.status, toStatus: to, comment: to === "DRAFT" ? (c.status === "REJECTED" ? "Revised by claimant" : "Withdrawn by claimant") : null } });
    if (to === "SUBMITTED") await recordActivity(actor.id, "CPD_SUBMITTED", `Submitted CPD claim: ${c.activity.title}`, { type: "cpd_claim", id: c.id }, undefined, tx);
  });
}

export async function deleteDraft(actor: Actor, claimId: string) {
  const c = await loadClaim(claimId);
  if (c.userId !== actor.id) throw notFound("CPD claim");
  if (c.status !== "DRAFT" || c.activity.courseCompletionId || c.activity.webinarAttendanceId) throw invalid("Only manual draft claims can be deleted.");
  await prisma.$transaction([prisma.cpdClaim.delete({ where: { id: c.id } }), prisma.cpdActivity.delete({ where: { id: c.activityId } })]);
}

export const decisionSchema = z.object({
  claimId: z.string(),
  decision: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
  approvedValue: z.coerce.number().optional().nullable(),
  comment: z.string().trim().max(2000).optional().nullable(),
});

/** Reviewer actions: Submitted → Under Review → Approved | Rejected. Every decision is recorded. */
export async function reviewClaim(actor: Actor, raw: unknown) {
  assertCan(actor, "cpd.approve");
  const { claimId, decision, approvedValue, comment } = decisionSchema.parse(raw);
  const c = await loadClaim(claimId);
  if (c.userId === actor.id) throw forbidden("You cannot review your own CPD claim.");
  let from = c.status;
  // Allow a reviewer to approve/reject a submitted claim directly; the Under Review step is recorded implicitly.
  const steps: CpdClaimStatus[] = from === "SUBMITTED" && decision !== "UNDER_REVIEW" ? ["UNDER_REVIEW", decision] : [decision];
  try {
    for (const to of steps) {
      assertCpdTransition(from, to, { reason: comment, approvedValue, claimedValue: Number(c.claimedValue) });
      from = to;
    }
  } catch (e) {
    transitionError(e);
  }
  await prisma.$transaction(async (tx) => {
    const r = await tx.cpdClaim.updateMany({
      where: { id: c.id, status: c.status },
      data: {
        status: decision,
        approvedValue: decision === "APPROVED" ? approvedValue : null,
        rejectionReason: decision === "REJECTED" ? comment : null,
        decidedAt: decision === "UNDER_REVIEW" ? null : new Date(),
      },
    });
    if (r.count !== 1) throw invalid("This claim was changed by someone else. Refresh and try again.");
    let prev = c.status;
    for (const to of steps) {
      await tx.cpdApproval.create({ data: { claimId: c.id, actorId: actor.id, fromStatus: prev, toStatus: to, value: to === "APPROVED" ? approvedValue : null, comment: to === decision ? comment : null } });
      prev = to;
    }
    if (decision !== "UNDER_REVIEW") {
      await recordActivity(c.userId, decision === "APPROVED" ? "CPD_APPROVED" : "CPD_REJECTED", `CPD claim ${decision === "APPROVED" ? `approved (${approvedValue} ${c.unit.toLowerCase()})` : "rejected"}: ${c.activity.title}`, { type: "cpd_claim", id: c.id }, undefined, tx);
    }
    await audit(actor.id, `cpd.${decision.toLowerCase()}`, "cpd_claim", c.id, { approvedValue: approvedValue ?? null }, tx);
  });
  if (decision !== "UNDER_REVIEW") {
    await notify(c.userId, {
      type: "CPD_DECISION",
      title: decision === "APPROVED" ? "CPD claim approved" : "CPD claim rejected",
      body: decision === "APPROVED" ? `${c.activity.title}: ${approvedValue} ${c.unit.toLowerCase()} approved.` : `${c.activity.title}: ${comment}`,
      link: `/cpd/${c.id}`,
      dedupeKey: `cpd-decision:${c.id}:${decision}:${Date.now()}`,
    });
  }
}

export async function getClaim(actor: Actor, claimId: string) {
  const c = await prisma.cpdClaim.findUnique({
    where: { id: claimId },
    include: {
      activity: { include: { competency: true } },
      evidence: { include: { file: { select: { id: true, originalName: true, sizeBytes: true } } } },
      approvals: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      period: true,
      user: { select: { id: true, name: true } },
    },
  });
  if (!c) throw notFound("CPD claim");
  if (c.userId !== actor.id && !can(actor, "cpd.approve")) await assertCanViewEmployee(actor, c.userId);
  return c;
}

export async function cpdWorkspace(userId: string, periodId?: string) {
  const period = periodId ? await prisma.reportingPeriod.findUnique({ where: { id: periodId } }) : await currentPeriod();
  const profile = await prisma.userProfile.findUnique({ where: { userId }, include: { cpdPolicy: true } });
  const policy = profile?.cpdPolicy ?? null;
  const claims = await prisma.cpdClaim.findMany({
    where: { userId, ...(period ? { periodId: period.id } : {}) },
    include: { activity: true },
    orderBy: { createdAt: "desc" },
  });
  const summary = period
    ? summarizeCpd(
        claims.map((c) => ({ status: c.status, claimedValue: Number(c.claimedValue), approvedValue: c.approvedValue == null ? null : Number(c.approvedValue) })),
        policy?.targetPerPeriod != null ? Number(policy.targetPerPeriod) : null,
        period,
      )
    : null;
  const byType = new Map<string, number>();
  for (const c of claims) if (c.status === "APPROVED") byType.set(c.activity.type, (byType.get(c.activity.type) ?? 0) + Number(c.approvedValue ?? 0));
  const byRecognition = { COMPANY_RECORDED: 0, PROFESSIONAL_BODY: 0 } as Record<string, number>;
  for (const c of claims) if (c.status === "APPROVED") byRecognition[c.recognition] += Number(c.approvedValue ?? 0);
  return {
    period,
    policy,
    claims,
    summary,
    byType: [...byType.entries()].map(([type, value]) => ({ type, label: CPD_TYPE_LABEL[type] ?? type, value: Math.round(value * 100) / 100 })),
    byRecognition,
  };
}

export async function reviewQueue(actor: Actor) {
  assertCan(actor, "cpd.approve");
  return prisma.cpdClaim.findMany({
    where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, userId: { not: actor.id } },
    include: { activity: true, user: { select: { name: true, profile: { include: { department: true } } } }, evidence: true },
    orderBy: { submittedAt: "asc" },
  });
}

export function decimal(n: Prisma.Decimal | number | null | undefined) {
  return n == null ? null : Number(n);
}
