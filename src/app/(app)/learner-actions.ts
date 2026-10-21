"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActorOrThrow } from "@/server/auth/session";
import { bool, optStr, runAction, str } from "@/server/action";
import * as learning from "@/server/services/learning";
import * as webinars from "@/server/services/webinars";
import * as cpd from "@/server/services/cpd";
import * as competency from "@/server/services/competency";
import * as plans from "@/server/services/plans";
import { formFile, saveFile } from "@/server/storage";
import { prisma } from "@/server/db";
import type { ActionState } from "@/lib/action-state";
import type { PlanStatus } from "@prisma/client";
import { getI18n } from "@/i18n/server";

type A = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/* ───── Courses ───── */

export const enrolAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    const e = await learning.enrol(actor, str(fd, "courseId"));
    return e.status === "PENDING_APPROVAL" ? t("Enrolment requested. Your line manager has been asked to approve it.") : t("You are enrolled.");
  }, ["/courses/[slug]", "/my-learning", "/dashboard"]);

export const withdrawAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await learning.withdraw(actor, str(fd, "courseId"));
    return t("You have withdrawn from the course.");
  }, ["/courses/[slug]", "/my-learning"]);

export const completeLessonAction: A = async (_, fd) => {
  const res = await runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    const out = await learning.completeLesson(actor, str(fd, "lessonId"));
    return out.completed ? t("Lesson complete — you have met all completion requirements for this course.") : t("Lesson marked complete.");
  });
  if (res.ok && str(fd, "next")) redirect(str(fd, "next"));
  revalidatePath("/learn/[slug]", "page");
  return res;
};

export const acknowledgeAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    if (!bool(fd, "confirm")) throw new (await import("@/server/errors")).AppError("VALIDATION", t("Tick the box to confirm your acknowledgement."));
    await learning.acknowledge(actor, str(fd, "courseId"));
    return t("Acknowledgement recorded.");
  }, ["/learn/[slug]"]);

export const submitAssessmentAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    const assessmentId = str(fd, "assessmentId");
    const questions = await prisma.assessmentQuestion.findMany({ where: { assessmentId }, select: { id: true, type: true } });
    const answers = questions.map((q) => {
      const v = optStr(fd, `q_${q.id}`);
      if (q.type === "MULTIPLE_CHOICE") return { questionId: q.id, selectedOptionId: v };
      if (q.type === "TRUE_FALSE") return { questionId: q.id, booleanAnswer: v == null ? null : v === "true" };
      return { questionId: q.id, textAnswer: v };
    });
    const unanswered = answers.filter((a) => Object.values(a).some((x) => x === null)).length;
    if (unanswered && !bool(fd, "allowBlank")) throw new (await import("@/server/errors")).AppError("VALIDATION", t("{count, plural, one {# question is} other {# questions are}} unanswered. Answer every question before submitting.", { count: unanswered }));
    const r = await learning.submitAssessment(actor, assessmentId, answers);
    if (r.status === "PENDING_REVIEW") return t("Submitted. Your short-answer responses will be reviewed by the instructor.");
    return r.passed ? t("Passed with {percent}%.", { percent: r.percent }) : t("You scored {percent}%. Review the material and try again.", { percent: r.percent });
  }, ["/learn/[slug]"]);

export const submitAssignmentAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    const f = formFile(fd, "file");
    const file = f ? await saveFile(f, "ASSIGNMENT_SUBMISSION", actor.id) : null;
    await learning.submitAssignment(actor, str(fd, "lessonId"), str(fd, "body"), file?.id ?? null);
    return t("Submitted for instructor review.");
  }, ["/learn/[slug]"]);

export async function heartbeat(lessonId: string, seconds: number, videoPosition?: number) {
  const actor = await requireActorOrThrow();
  await learning.recordLessonView(actor, lessonId, { seconds, videoPosition });
}

export const startPathAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await learning.startLearningPath(actor, str(fd, "pathId"));
    return t("Learning path started. Enrol in the first course to begin.");
  }, ["/learning-paths/[slug]", "/dashboard"]);

/* ───── Webinars ───── */

export const registerWebinarAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    const r = await webinars.register(actor, str(fd, "webinarId"));
    return r.status === "WAITLISTED" ? t("The session is full — you have been added to the waitlist.") : t("You are registered. A confirmation has been added to your notifications.");
  }, ["/webinars/[slug]", "/webinars"]);

export const cancelWebinarAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await webinars.cancelRegistration(actor, str(fd, "webinarId"));
    return t("Registration cancelled.");
  }, ["/webinars/[slug]", "/webinars"]);

export const webinarFeedbackAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await webinars.submitFeedback(actor, { webinarId: str(fd, "webinarId"), rating: str(fd, "rating"), relevance: str(fd, "relevance") || undefined, comments: str(fd, "comments") });
    return t("Thank you — your feedback has been recorded.");
  }, ["/webinars/[slug]"]);

/* ───── CPD ───── */

export const createClaimAction: A = async (_, fd) => {
  let id = "";
  const res = await runAction(async () => {
    const actor = await requireActorOrThrow();
    const f = formFile(fd, "evidenceFile");
    const file = f ? await saveFile(f, "CPD_EVIDENCE", actor.id) : null;
    const claim = await cpd.createClaim(
      actor,
      {
        title: str(fd, "title"),
        type: str(fd, "type"),
        provider: str(fd, "provider"),
        activityDate: str(fd, "activityDate"),
        durationHours: str(fd, "durationHours"),
        claimedValue: str(fd, "claimedValue"),
        description: str(fd, "description"),
        learningOutcomes: str(fd, "learningOutcomes"),
        competencyId: optStr(fd, "competencyId"),
        recognition: str(fd, "recognition") || "COMPANY_RECORDED",
        evidenceDescription: str(fd, "evidenceDescription"),
        evidenceReference: str(fd, "evidenceReference"),
        submit: str(fd, "intent") === "submit",
      },
      file ? [file.id] : [],
    );
    id = claim.id;
  }, ["/cpd"]);
  if (res.ok) redirect(`/cpd/${id}?created=1`);
  return res;
};

export const claimOwnerAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    const to = str(fd, "to");
    if (to === "DELETE") {
      await cpd.deleteDraft(actor, str(fd, "claimId"));
      redirect("/cpd");
    }
    await cpd.ownerTransition(actor, str(fd, "claimId"), to as "SUBMITTED" | "DRAFT");
    return to === "SUBMITTED" ? t("Claim submitted for review.") : t("Claim returned to draft.");
  }, ["/cpd", "/cpd/[id]"]);

/* ───── Competency ───── */

export const requestCompetencyReviewAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    const f = formFile(fd, "file");
    const file = f ? await saveFile(f, "COMPETENCY_EVIDENCE", actor.id) : null;
    await competency.requestReview(actor, { competencyId: str(fd, "competencyId"), requestedLevel: str(fd, "requestedLevel"), statement: str(fd, "statement") }, file?.id ?? null);
    return t("Review request sent to your line manager.");
  }, ["/competencies"]);

/* ───── Development plan ───── */

export const createPlanAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await plans.createPlan(actor, { title: str(fd, "title"), careerAspiration: str(fd, "careerAspiration"), targetJobRoleId: optStr(fd, "targetJobRoleId") });
    return t("Development plan created. Add your objectives.");
  }, ["/development-plan"]);

function objectiveInput(fd: FormData) {
  return {
    goal: str(fd, "goal"),
    currentCapability: str(fd, "currentCapability"),
    targetCapability: str(fd, "targetCapability"),
    competencyId: optStr(fd, "competencyId"),
    competencyGap: str(fd, "competencyGap"),
    workplaceApplication: str(fd, "workplaceApplication"),
    supportingEvidence: str(fd, "supportingEvidence"),
    responsible: str(fd, "responsible"),
    learningModel: optStr(fd, "learningModel"),
    targetDate: optStr(fd, "targetDate"),
    reviewDate: optStr(fd, "reviewDate"),
    status: optStr(fd, "status") ?? undefined,
  };
}

export const saveObjectiveAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await plans.upsertObjective(actor, str(fd, "planId"), optStr(fd, "objectiveId"), objectiveInput(fd));
    return t("Objective saved.");
  }, ["/development-plan", "/manager/team/[userId]"]);

export const deleteObjectiveAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await plans.deleteObjective(actor, str(fd, "planId"), str(fd, "objectiveId"));
    return t("Objective removed.");
  }, ["/development-plan"]);

export const addPlanActionAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await plans.addAction(actor, str(fd, "planId"), { objectiveId: str(fd, "objectiveId"), title: str(fd, "title"), type: str(fd, "type"), courseId: optStr(fd, "courseId"), dueDate: optStr(fd, "dueDate") });
    return t("Action added.");
  }, ["/development-plan"]);

export const togglePlanActionAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await plans.toggleAction(actor, str(fd, "planId"), str(fd, "actionId"));
    return t("Updated.");
  }, ["/development-plan"]);

export const planTransitionAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await plans.transitionPlan(actor, str(fd, "planId"), str(fd, "to") as PlanStatus, optStr(fd, "comment"));
    return t("Plan status updated.");
  }, ["/development-plan", "/manager/team/[userId]", "/manager"]);

export const planCommentAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await plans.addComment(actor, str(fd, "planId"), str(fd, "body"), optStr(fd, "objectiveId"));
    return t("Comment added.");
  }, ["/development-plan", "/manager/team/[userId]"]);

export const managerFeedbackAction: A = async (_, fd) =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await plans.setManagerFeedback(actor, str(fd, "planId"), str(fd, "objectiveId"), str(fd, "feedback"));
    return t("Feedback saved.");
  }, ["/manager/team/[userId]"]);

/* ───── Notifications & profile ───── */

export const markAllReadAction: A = async () =>
  runAction(async () => {
    const { t } = await getI18n();
    const actor = await requireActorOrThrow();
    await prisma.notification.updateMany({ where: { userId: actor.id, readAt: null }, data: { readAt: new Date() } });
    return t("All notifications marked as read.");
  }, ["/notifications"]);

export async function openNotification(fd: FormData) {
  const actor = await requireActorOrThrow();
  const n = await prisma.notification.findFirst({ where: { id: str(fd, "id"), userId: actor.id } });
  if (!n) redirect("/notifications");
  if (!n.readAt) await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  redirect(n.link && n.link.startsWith("/") ? n.link : "/notifications");
}
