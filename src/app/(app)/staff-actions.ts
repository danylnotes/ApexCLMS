"use server";

import { redirect } from "next/navigation";
import { requireActorOrThrow } from "@/server/auth/session";
import { bool, optStr, runAction, str } from "@/server/action";
import { formFile, saveFile } from "@/server/storage";
import * as ac from "@/server/services/admin-courses";
import * as org from "@/server/services/admin-org";
import * as misc from "@/server/services/admin-misc";
import * as learning from "@/server/services/learning";
import * as webinars from "@/server/services/webinars";
import * as cpd from "@/server/services/cpd";
import * as competency from "@/server/services/competency";
import { assignLearning, cancelAssignment } from "@/server/services/assignments";
import { runScheduledJobs } from "@/server/services/jobs";
import { assertCan } from "@/server/policy";
import type { ActionState } from "@/lib/action-state";
import type { SettingKey } from "@/server/settings";

type A = (prev: ActionState, fd: FormData) => Promise<ActionState>;
const num = (fd: FormData, k: string) => (optStr(fd, k) == null ? null : Number(str(fd, k)));
const all = (fd: FormData, k: string) => fd.getAll(k).map(String).filter(Boolean);

/* ───── Manager ───── */

export const assignAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const [kind, ref] = str(fd, "item").split(":");
    const r = await assignLearning(actor, {
      target: str(fd, "target") || "USERS",
      userIds: all(fd, "userIds"),
      departmentId: optStr(fd, "departmentId"),
      jobRoleId: optStr(fd, "jobRoleId"),
      courseId: kind === "course" ? ref : null,
      pathId: kind === "path" ? ref : null,
      kind: str(fd, "kind") || "REQUIRED",
      isMandatory: bool(fd, "isMandatory"),
      dueDate: optStr(fd, "dueDate"),
      reason: str(fd, "reason"),
    });
    return `${r.created} assignment${r.created === 1 ? "" : "s"} created${r.skipped ? `; ${r.skipped} skipped (already assigned)` : ""}.`;
  }, ["/manager/assign", "/manager", "/admin"]);

export const cancelAssignmentAction: A = async (_, fd) =>
  runAction(async () => {
    await cancelAssignment(await requireActorOrThrow(), str(fd, "assignmentId"));
    return "Assignment cancelled.";
  }, ["/manager/assign", "/manager/team/[userId]"]);

export const enrolmentDecisionAction: A = async (_, fd) =>
  runAction(async () => {
    await learning.decideEnrolment(await requireActorOrThrow(), str(fd, "enrollmentId"), str(fd, "decision") === "approve", str(fd, "note"));
    return "Decision recorded.";
  }, ["/manager/assign", "/manager"]);

export const recordCompetencyAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const f = formFile(fd, "file");
    const file = f ? await saveFile(f, "COMPETENCY_EVIDENCE", actor.id) : null;
    await competency.recordAssessment(actor, { userId: str(fd, "userId"), competencyId: str(fd, "competencyId"), level: str(fd, "level"), method: str(fd, "method"), notes: str(fd, "notes"), evidenceDescription: str(fd, "evidenceDescription"), evidenceReference: str(fd, "evidenceReference"), requestId: optStr(fd, "requestId") }, file?.id ?? null);
    return "Assessment recorded. The previous assessment has been superseded and kept in history.";
  }, ["/manager/team/[userId]", "/manager/gaps"]);

export const declineCompetencyRequestAction: A = async (_, fd) =>
  runAction(async () => {
    await competency.declineRequest(await requireActorOrThrow(), str(fd, "requestId"), str(fd, "note"));
    return "Request closed and the employee notified.";
  }, ["/manager/team/[userId]"]);

/* ───── Teaching ───── */

export const gradeAttemptAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const grades = all(fd, "responseId").map((id) => ({ responseId: id, points: Number(str(fd, `points_${id}`)), feedback: str(fd, `feedback_${id}`) || undefined }));
    await learning.gradeAttempt(actor, { attemptId: str(fd, "attemptId"), grades, feedback: str(fd, "feedback") || undefined });
    return "Attempt graded and the learner notified.";
  }, ["/teaching"]);

export const reviewSubmissionAction: A = async (_, fd) =>
  runAction(async () => {
    await learning.reviewSubmission(await requireActorOrThrow(), str(fd, "submissionId"), str(fd, "decision") === "approve", str(fd, "feedback"));
    return "Review recorded.";
  }, ["/teaching"]);

export const attendanceAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const entries = all(fd, "registrationId").map((id) => ({
      registrationId: id,
      attended: str(fd, `attended_${id}`) === "yes",
      attendedMinutes: optStr(fd, `minutes_${id}`) ? Number(str(fd, `minutes_${id}`)) : null,
      verification: str(fd, "verification"),
      notes: optStr(fd, "notes"),
    })).filter((e) => str(fd, `attended_${e.registrationId}`) !== "");
    if (!entries.length) return "No attendance changes to record.";
    const r = await webinars.recordAttendance(actor, { webinarId: str(fd, "webinarId"), entries });
    return `Attendance recorded for ${r.updated} participant${r.updated === 1 ? "" : "s"}.`;
  }, ["/admin/webinars/[id]", "/teaching"]);

export const processCpdAction: A = async (_, fd) =>
  runAction(async () => {
    const r = await webinars.processWebinarCpd(await requireActorOrThrow(), str(fd, "webinarId"));
    return `CPD processed: ${r.processed} claim${r.processed === 1 ? "" : "s"} raised${r.skipped ? `, ${r.skipped} not eligible (attendance below minimum or policy excludes webinars)` : ""}.`;
  }, ["/admin/webinars/[id]"]);

/* ───── CPD review ───── */

export const cpdDecisionAction: A = async (_, fd) =>
  runAction(async () => {
    await cpd.reviewClaim(await requireActorOrThrow(), { claimId: str(fd, "claimId"), decision: str(fd, "decision"), approvedValue: optStr(fd, "approvedValue"), comment: optStr(fd, "comment") });
    return "Decision recorded.";
  }, ["/admin/cpd", "/cpd/[id]"]);

export const savePolicyAction: A = async (_, fd) =>
  runAction(async () => {
    await misc.savePolicy(await requireActorOrThrow(), optStr(fd, "id"), { name: str(fd, "name"), description: str(fd, "description"), professionalBody: str(fd, "professionalBody"), unit: str(fd, "unit"), targetPerPeriod: num(fd, "targetPerPeriod"), pointsPerHour: num(fd, "pointsPerHour"), maxPerActivity: num(fd, "maxPerActivity"), eligibleTypes: all(fd, "eligibleTypes"), autoApproveVerifiedInternal: bool(fd, "autoApprove"), isActive: !bool(fd, "inactive") });
    return "CPD policy saved.";
  }, ["/admin/cpd"]);

export const savePeriodAction: A = async (_, fd) =>
  runAction(async () => {
    await misc.savePeriod(await requireActorOrThrow(), str(fd, "name").trim(), new Date(str(fd, "startDate")), new Date(str(fd, "endDate") + "T23:59:59Z"), bool(fd, "isCurrent"));
    return "Reporting period saved.";
  }, ["/admin/cpd"]);

/* ───── Courses ───── */

function courseDetails(fd: FormData) {
  return {
    code: str(fd, "code").toUpperCase(), title: str(fd, "title"), categoryId: str(fd, "categoryId"), synopsis: str(fd, "synopsis"), overview: str(fd, "overview"),
    businessRelevance: str(fd, "businessRelevance"), intendedAudience: str(fd, "intendedAudience"), prerequisitesText: str(fd, "prerequisitesText"), objectives: str(fd, "objectives"),
    outcomes: str(fd, "outcomes"), keywords: str(fd, "keywords"), difficulty: str(fd, "difficulty"), deliveryMode: str(fd, "deliveryMode"), provider: str(fd, "provider"),
    estimatedHours: str(fd, "estimatedHours"), departmentIds: all(fd, "departmentIds"),
  };
}

export const createCourseAction: A = async (_, fd) => {
  let id = "";
  const res = await runAction(async () => {
    id = (await ac.createCourse(await requireActorOrThrow(), courseDetails(fd))).id;
  }, ["/admin/courses"]);
  if (res.ok) redirect(`/admin/courses/${id}?tab=curriculum&created=1`);
  return res;
};

export const updateCourseAction: A = async (_, fd) =>
  runAction(async () => {
    await ac.updateCourseDetails(await requireActorOrThrow(), str(fd, "courseId"), courseDetails(fd));
    return "Course details saved.";
  }, ["/admin/courses/[id]"]);

export const courseRulesAction: A = async (_, fd) =>
  runAction(async () => {
    const competencies = all(fd, "competencyIds").map((competencyId) => ({ competencyId, targetLevel: Number(str(fd, `level_${competencyId}`) || 1) }));
    await ac.updateCourseRules(await requireActorOrThrow(), str(fd, "courseId"), {
      requireAllLessons: bool(fd, "requireAllLessons"), requireAssessmentPass: bool(fd, "requireAssessmentPass"), requireAssignmentApproval: bool(fd, "requireAssignmentApproval"),
      requireAcknowledgement: bool(fd, "requireAcknowledgement"), acknowledgementText: str(fd, "acknowledgementText"), certificateEnabled: bool(fd, "certificateEnabled"),
      certificateValidityMonths: num(fd, "certificateValidityMonths"), recertificationNote: str(fd, "recertificationNote"), cpdEligible: bool(fd, "cpdEligible"),
      cpdValue: num(fd, "cpdValue"), cpdUnit: str(fd, "cpdUnit") || "HOURS", cpdAccreditationNote: str(fd, "cpdAccreditationNote"), isMandatory: bool(fd, "isMandatory"),
      enrolmentRule: str(fd, "enrolmentRule"), prerequisiteIds: all(fd, "prerequisiteIds"), instructorIds: all(fd, "instructorIds"), competencies,
    });
    return "Rules saved.";
  }, ["/admin/courses/[id]"]);

export const courseStatusAction: A = async (_, fd) =>
  runAction(async () => {
    const to = str(fd, "to") as "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
    await ac.setCourseStatus(await requireActorOrThrow(), str(fd, "courseId"), to);
    return { DRAFT: "Course returned to draft.", IN_REVIEW: "Submitted for review.", PUBLISHED: "Course published.", ARCHIVED: "Course archived." }[to];
  }, ["/admin/courses/[id]", "/admin/courses", "/catalogue"]);

export const moduleAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const op = str(fd, "op");
    if (op === "add") await ac.addModule(actor, str(fd, "courseId"), str(fd, "title"), str(fd, "description"));
    if (op === "update") await ac.updateModule(actor, str(fd, "moduleId"), str(fd, "title"), str(fd, "description"));
    if (op === "delete") await ac.deleteModule(actor, str(fd, "moduleId"));
    if (op === "up" || op === "down") await ac.moveModule(actor, str(fd, "moduleId"), op === "up" ? -1 : 1);
    return "Curriculum updated.";
  }, ["/admin/courses/[id]"]);

export const lessonAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const op = str(fd, "op");
    if (op === "delete") await ac.deleteLesson(actor, str(fd, "lessonId"));
    else if (op === "up" || op === "down") await ac.moveLesson(actor, str(fd, "lessonId"), op === "up" ? -1 : 1);
    else if (op === "removeResource") await ac.removeLessonResource(actor, str(fd, "resourceId"));
    else {
      const lesson = await ac.saveLesson(actor, str(fd, "moduleId"), optStr(fd, "lessonId"), {
        title: str(fd, "title"), type: str(fd, "type"), body: str(fd, "body"), videoUrl: str(fd, "videoUrl"), externalUrl: str(fd, "externalUrl"),
        durationMinutes: num(fd, "durationMinutes"), isRequired: bool(fd, "isRequired"), assessmentId: optStr(fd, "assessmentId"),
      });
      const f = formFile(fd, "resource");
      if (f) {
        const file = await saveFile(f, "COURSE_MATERIAL", actor.id);
        await ac.addLessonResource(actor, lesson.id, file.id, str(fd, "resourceLabel") || f.name.replace(/\.[^.]+$/, ""));
      }
    }
    return "Lesson saved.";
  }, ["/admin/courses/[id]"]);

export const assessmentAction: A = async (_, fd) =>
  runAction(async () => {
    await ac.saveAssessment(await requireActorOrThrow(), str(fd, "courseId"), optStr(fd, "assessmentId"), { title: str(fd, "title"), description: str(fd, "description"), passingScore: str(fd, "passingScore"), maxAttempts: str(fd, "maxAttempts"), timeLimitMinutes: num(fd, "timeLimitMinutes"), isFinal: bool(fd, "isFinal") });
    return "Assessment saved.";
  }, ["/admin/courses/[id]"]);

export const questionAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    if (str(fd, "op") === "delete") {
      await ac.deleteQuestion(actor, str(fd, "questionId"));
      return "Question removed.";
    }
    await ac.saveQuestion(actor, str(fd, "assessmentId"), optStr(fd, "questionId"), { type: str(fd, "type"), prompt: str(fd, "prompt"), points: str(fd, "points") || "1", options: [0, 1, 2, 3, 4].map((i) => str(fd, `option_${i}`)), correctIndex: optStr(fd, "correctIndex") ?? undefined, correctBoolean: optStr(fd, "correctBoolean") ?? undefined, guidance: str(fd, "guidance") });
    return "Question saved.";
  }, ["/admin/courses/[id]"]);

/* ───── Learning paths ───── */

export const pathAction: A = async (_, fd) => {
  let id = optStr(fd, "pathId");
  const res = await runAction(async () => {
    const actor = await requireActorOrThrow();
    const op = str(fd, "op");
    if (op === "save") {
      const p = await misc.savePath(actor, id, { code: str(fd, "code").toUpperCase(), title: str(fd, "title"), summary: str(fd, "summary"), targetAudience: str(fd, "targetAudience"), entryRequirements: str(fd, "entryRequirements"), completionCriteria: str(fd, "completionCriteria"), estimatedDurationWeeks: num(fd, "estimatedDurationWeeks"), cpdEligible: bool(fd, "cpdEligible"), targetJobRoleId: optStr(fd, "targetJobRoleId"), competencyIds: all(fd, "competencyIds") });
      if (!id) {
        id = p.id;
        return "created";
      }
    }
    if (op === "addItem") await misc.addPathItem(actor, id!, str(fd, "courseId"), bool(fd, "isRequired"), optStr(fd, "prerequisiteItemId"));
    if (op === "removeItem") await misc.removePathItem(actor, str(fd, "itemId"));
    if (op === "status") await misc.setPathStatus(actor, id!, str(fd, "to") as "DRAFT" | "PUBLISHED" | "ARCHIVED");
    return "Learning path updated.";
  }, ["/admin/paths", "/admin/paths/[id]", "/learning-paths"]);
  if (res.ok && res.message === "created") redirect(`/admin/paths/${id}`);
  return res;
};

/* ───── Webinars ───── */

function webinarInput(fd: FormData) {
  return {
    code: str(fd, "code").toUpperCase(), title: str(fd, "title"), synopsis: str(fd, "synopsis"), overview: str(fd, "overview"), objectives: str(fd, "objectives"), speakerName: str(fd, "speakerName"),
    speakerTitle: str(fd, "speakerTitle"), speakerBio: str(fd, "speakerBio"), categoryId: optStr(fd, "categoryId"), startsAt: str(fd, "startsAt") ? `${str(fd, "startsAt")}:00Z` : "",
    durationMinutes: str(fd, "durationMinutes"), timeZone: str(fd, "timeZone"), capacity: num(fd, "capacity"), registrationRequirements: str(fd, "registrationRequirements"),
    minAttendanceMinutes: num(fd, "minAttendanceMinutes"), cpdEligible: bool(fd, "cpdEligible"), cpdValue: num(fd, "cpdValue"), meetingProvider: str(fd, "meetingProvider") || "NONE",
    meetingUrl: str(fd, "meetingUrl"), status: bool(fd, "draft") ? "DRAFT" : "SCHEDULED",
  };
}

export const saveWebinarAction: A = async (_, fd) => {
  let id = optStr(fd, "webinarId");
  const res = await runAction(async () => {
    const actor = await requireActorOrThrow();
    const input = webinarInput(fd);
    // startsAt is entered as local time in the event time zone; convert to UTC.
    if (str(fd, "startsAt")) input.startsAt = zonedToUtc(str(fd, "startsAt"), str(fd, "timeZone")).toISOString();
    const w = await misc.saveWebinar(actor, id, input);
    if (!id) {
      id = w.id;
      return "created";
    }
    return "Webinar saved.";
  }, ["/admin/webinars", "/webinars"]);
  if (res.ok && res.message === "created") redirect(`/admin/webinars/${id}?created=1`);
  return res;
};

/** Converts a wall-clock time ("YYYY-MM-DDTHH:mm") in an IANA time zone to a UTC Date. */
function zonedToUtc(local: string, timeZone: string) {
  const asUtc = new Date(`${local}:00Z`);
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(asUtc);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const shown = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
    return new Date(asUtc.getTime() - (shown - asUtc.getTime()));
  } catch {
    return asUtc;
  }
}

export const webinarOpsAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const op = str(fd, "op");
    if (op === "cancel") await misc.cancelWebinar(actor, str(fd, "webinarId"), str(fd, "reason"));
    if (op === "recording") await misc.addRecording(actor, str(fd, "webinarId"), str(fd, "title"), str(fd, "url"), num(fd, "durationMinutes"), optStr(fd, "availableUntil") ? new Date(str(fd, "availableUntil")) : null);
    return op === "cancel" ? "Webinar cancelled; registrants notified." : "Recording added.";
  }, ["/admin/webinars/[id]", "/webinars"]);

/* ───── Competency framework ───── */

export const frameworkAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const op = str(fd, "op");
    const fw = str(fd, "frameworkId");
    if (op === "framework") await misc.updateFramework(actor, fw, { name: str(fd, "name"), version: str(fd, "version"), description: str(fd, "description"), status: str(fd, "status") as "ACTIVE", allowCourseCompletionAsCompetence: bool(fd, "allowCourse") });
    if (op === "level") await misc.saveLevel(actor, fw, Number(str(fd, "level")), str(fd, "name"), str(fd, "description"));
    if (op === "domain") await misc.saveDomain(actor, fw, str(fd, "name"));
    if (op === "competency") await misc.saveCompetency(actor, optStr(fd, "competencyId"), { domainId: str(fd, "domainId"), code: str(fd, "code").toUpperCase(), name: str(fd, "name"), description: str(fd, "description"), evidenceRequirements: str(fd, "evidenceRequirements"), assessmentCriteria: str(fd, "assessmentCriteria"), reassessmentMonths: num(fd, "reassessmentMonths"), isActive: !bool(fd, "inactive") });
    return "Framework updated.";
  }, ["/admin/competencies"]);

export const roleRequirementsAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const jobRoleId = str(fd, "jobRoleId");
    for (const cid of all(fd, "competencyIds")) {
      const lvl = Number(str(fd, `req_${cid}`) || 0);
      await misc.setRoleRequirement(actor, jobRoleId, cid, lvl || null, bool(fd, `crit_${cid}`));
    }
    return "Role requirements saved.";
  }, ["/admin/competencies"]);

/* ───── Users & organisation ───── */

function userInput(fd: FormData) {
  return {
    name: str(fd, "name"), email: str(fd, "email"), employeeNumber: str(fd, "employeeNumber"), departmentId: optStr(fd, "departmentId"), jobRoleId: optStr(fd, "jobRoleId"),
    targetJobRoleId: optStr(fd, "targetJobRoleId"), businessUnitId: optStr(fd, "businessUnitId"), location: str(fd, "location"), employmentStatus: str(fd, "employmentStatus") || "PERMANENT",
    learningProgramme: str(fd, "learningProgramme"), cpdPolicyId: optStr(fd, "cpdPolicyId"), managerId: optStr(fd, "managerId"), roleKeys: all(fd, "roleKeys"),
  };
}

export const createUserAction: A = async (_, fd) => {
  let id = "";
  const res = await runAction(async () => {
    const r = await org.createUser(await requireActorOrThrow(), userInput(fd), { invite: bool(fd, "invite") });
    id = r.user.id;
  }, ["/admin/users"]);
  if (res.ok) redirect(`/admin/users/${id}?created=1`);
  return res;
};

export const updateUserAction: A = async (_, fd) =>
  runAction(async () => {
    await org.updateUser(await requireActorOrThrow(), str(fd, "userId"), userInput(fd));
    return "User updated.";
  }, ["/admin/users", "/admin/users/[id]"]);

export const userStatusAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const op = str(fd, "op");
    if (op === "invite") {
      const { sendInvitation } = await import("@/server/services/auth");
      await sendInvitation(str(fd, "userId"), actor.id);
      return "Invitation sent.";
    }
    await org.setUserStatus(actor, str(fd, "userId"), op === "activate" ? "ACTIVE" : "DEACTIVATED");
    return op === "activate" ? "User activated." : "User deactivated and signed out of all sessions.";
  }, ["/admin/users", "/admin/users/[id]"]);

export const importUsersAction: A = async (_, fd) =>
  runAction(async () => {
    const f = formFile(fd, "file");
    if (!f) throw new (await import("@/server/errors")).AppError("VALIDATION", "Choose a CSV file.");
    if (f.size > 1_000_000) throw new (await import("@/server/errors")).AppError("VALIDATION", "The CSV file must be smaller than 1 MB.");
    const r = await org.importUsersCsv(await requireActorOrThrow(), await f.text(), bool(fd, "invite"));
    if (r.errors.length) throw new (await import("@/server/errors")).AppError("VALIDATION", `No users were imported. ${r.errors.length} problem(s): ${r.errors.slice(0, 8).map((e) => `line ${e.line}: ${e.message}`).join(" ")}`);
    return `${r.created} users imported${bool(fd, "invite") ? " and invited" : ""}.`;
  }, ["/admin/users"]);

export const orgDataAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    const op = str(fd, "op");
    if (op === "department") await misc.saveDepartment(actor, str(fd, "code").toUpperCase(), str(fd, "name"), optStr(fd, "businessUnitId"));
    if (op === "unit") await misc.saveBusinessUnit(actor, str(fd, "code").toUpperCase(), str(fd, "name"));
    if (op === "jobRole") await misc.saveJobRole(actor, str(fd, "code").toUpperCase(), str(fd, "title"), optStr(fd, "departmentId"), str(fd, "careerTrack"), num(fd, "grade"), num(fd, "minYears"));
    if (op === "category") await misc.saveCategory(actor, optStr(fd, "categoryId"), str(fd, "name"), str(fd, "description"), !bool(fd, "inactive"));
    if (op === "credential") await misc.addCredential(actor, str(fd, "userId"), { name: str(fd, "name"), issuer: str(fd, "issuer"), credentialNo: str(fd, "credentialNo"), issuedOn: new Date(str(fd, "issuedOn")), expiresOn: optStr(fd, "expiresOn") ? new Date(str(fd, "expiresOn")) : null, verify: bool(fd, "verify") });
    return "Saved.";
  }, ["/admin/users", "/admin/users/[id]", "/admin/courses"]);

export const rolePermissionAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    assertCan(actor, "role.manage");
    const roleId = str(fd, "roleId");
    const want = new Set(all(fd, "permissions"));
    const { PERMISSIONS } = await import("@/server/permissions");
    const { prisma } = await import("@/server/db");
    const current = new Set((await prisma.rolePermission.findMany({ where: { roleId }, include: { permission: true } })).map((rp) => rp.permission.key));
    for (const key of Object.keys(PERMISSIONS)) {
      if (want.has(key) !== current.has(key)) await org.setRolePermission(actor, roleId, key, want.has(key));
    }
    return "Role permissions saved.";
  }, ["/admin/roles"]);

export const certificateAdminAction: A = async (_, fd) =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    if (str(fd, "op") === "revoke") {
      await misc.revokeCertificate(actor, str(fd, "certificateId"), str(fd, "reason"));
      return "Certificate revoked.";
    }
    await misc.saveTemplate(actor, optStr(fd, "templateId"), { name: str(fd, "name"), heading: str(fd, "heading"), bodyText: str(fd, "bodyText"), signatoryName: str(fd, "signatoryName"), signatoryTitle: str(fd, "signatoryTitle"), isDefault: bool(fd, "isDefault") });
    return "Template saved.";
  }, ["/admin/certificates"]);

export const settingsAction: A = async (_, fd) =>
  runAction(async () => {
    const key = str(fd, "section") as SettingKey;
    const value: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) if (!k.startsWith("$") && k !== "section") value[k] = v;
    if (key === "notifications") value.emailEnabled = bool(fd, "emailEnabled");
    await org.saveSettings(await requireActorOrThrow(), key, value);
    return "Configuration saved.";
  }, ["/admin/settings", "/", "/login"]);

export const runJobsAction: A = async () =>
  runAction(async () => {
    const actor = await requireActorOrThrow();
    assertCan(actor, "settings.manage");
    const r = await runScheduledJobs();
    return `Scheduled processes ran: ${Object.entries(r).map(([k, v]) => `${k} ${v}`).join(", ")}.`;
  }, ["/admin"]);
