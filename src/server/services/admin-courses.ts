import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertCan, assertCanManageCourse } from "../policy";
import { audit } from "../audit";
import { validateCompletionConfig } from "@/lib/domain/completion";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

export const courseDetailsSchema = z.object({
  code: z.string().trim().min(3).max(20).regex(/^[A-Z0-9-]+$/, "Use upper-case letters, digits and hyphens"),
  title: z.string().trim().min(5).max(200),
  categoryId: z.string().min(1, "Choose a category"),
  synopsis: z.string().trim().min(20).max(600),
  overview: z.string().trim().min(20).max(8000),
  businessRelevance: z.string().trim().max(2000).optional().default(""),
  intendedAudience: z.string().trim().max(2000).optional().default(""),
  prerequisitesText: z.string().trim().max(1000).optional().default(""),
  objectives: z.string().max(4000).default(""),
  outcomes: z.string().max(4000).default(""),
  keywords: z.string().max(500).default(""),
  difficulty: z.enum(["FOUNDATION", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
  deliveryMode: z.enum(["SELF_PACED", "INSTRUCTOR_LED", "BLENDED", "VIRTUAL_CLASSROOM"]),
  provider: z.string().trim().min(2).max(200),
  estimatedHours: z.coerce.number().positive().max(500),
  departmentIds: z.array(z.string()).default([]),
});

export async function createCourse(actor: Actor, raw: unknown) {
  assertCan(actor, "course.manage");
  const i = courseDetailsSchema.parse(raw);
  if (await prisma.course.findUnique({ where: { code: i.code } })) throw conflict("A course with this code already exists.");
  const c = await prisma.course.create({
    data: {
      code: i.code, slug: `${i.code.toLowerCase()}-${slugify(i.title)}`, title: i.title, categoryId: i.categoryId, synopsis: i.synopsis, overview: i.overview,
      businessRelevance: i.businessRelevance || null, intendedAudience: i.intendedAudience || null, prerequisitesText: i.prerequisitesText || null,
      objectives: lines(i.objectives), outcomes: lines(i.outcomes), keywords: i.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
      difficulty: i.difficulty, deliveryMode: i.deliveryMode, provider: i.provider, estimatedHours: i.estimatedHours, status: "DRAFT", createdById: actor.id,
      departments: { create: i.departmentIds.map((departmentId) => ({ departmentId })) },
    },
  });
  await audit(actor.id, "course.create", "course", c.id, { code: c.code });
  return c;
}

export async function updateCourseDetails(actor: Actor, courseId: string, raw: unknown) {
  await assertCanManageCourse(actor, courseId);
  const i = courseDetailsSchema.parse(raw);
  const dup = await prisma.course.findFirst({ where: { code: i.code, id: { not: courseId } } });
  if (dup) throw conflict("A course with this code already exists.");
  await prisma.$transaction([
    prisma.course.update({
      where: { id: courseId },
      data: {
        code: i.code, title: i.title, categoryId: i.categoryId, synopsis: i.synopsis, overview: i.overview, businessRelevance: i.businessRelevance || null,
        intendedAudience: i.intendedAudience || null, prerequisitesText: i.prerequisitesText || null, objectives: lines(i.objectives), outcomes: lines(i.outcomes),
        keywords: i.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean), difficulty: i.difficulty, deliveryMode: i.deliveryMode, provider: i.provider, estimatedHours: i.estimatedHours,
      },
    }),
    prisma.courseDepartment.deleteMany({ where: { courseId } }),
    prisma.courseDepartment.createMany({ data: i.departmentIds.map((departmentId) => ({ courseId, departmentId })) }),
  ]);
  await audit(actor.id, "course.update", "course", courseId);
}

export const rulesSchema = z.object({
  requireAllLessons: z.boolean(),
  requireAssessmentPass: z.boolean(),
  requireAssignmentApproval: z.boolean(),
  requireAcknowledgement: z.boolean(),
  acknowledgementText: z.string().trim().max(1000).optional().default(""),
  certificateEnabled: z.boolean(),
  certificateValidityMonths: z.coerce.number().int().min(1).max(120).nullable().optional(),
  recertificationNote: z.string().trim().max(500).optional().default(""),
  cpdEligible: z.boolean(),
  cpdValue: z.coerce.number().min(0).max(200).nullable().optional(),
  cpdUnit: z.enum(["HOURS", "POINTS"]),
  cpdAccreditationNote: z.string().trim().max(500).optional().default(""),
  isMandatory: z.boolean(),
  enrolmentRule: z.enum(["OPEN", "APPROVAL_REQUIRED", "ASSIGNED_ONLY"]),
  prerequisiteIds: z.array(z.string()).default([]),
  instructorIds: z.array(z.string()).default([]),
  competencies: z.array(z.object({ competencyId: z.string(), targetLevel: z.coerce.number().int().min(1).max(10) })).default([]),
});

/** Completion, certification, CPD and enrolment rules — administrators only. */
export async function updateCourseRules(actor: Actor, courseId: string, raw: unknown) {
  assertCan(actor, "course.manage");
  const r = rulesSchema.parse(raw);
  if (r.cpdEligible && !(r.cpdValue && r.cpdValue > 0)) throw invalid("Enter the CPD value for a CPD-eligible course. Estimated study time is not used automatically.");
  if (r.prerequisiteIds.includes(courseId)) throw invalid("A course cannot be its own prerequisite.");
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Course");
  await prisma.$transaction(async (tx) => {
    await tx.course.update({
      where: { id: courseId },
      data: {
        requireAllLessons: r.requireAllLessons, requireAssessmentPass: r.requireAssessmentPass, requireAssignmentApproval: r.requireAssignmentApproval,
        requireAcknowledgement: r.requireAcknowledgement, acknowledgementText: r.acknowledgementText || null, certificateEnabled: r.certificateEnabled,
        certificateValidityMonths: r.certificateValidityMonths ?? null, recertificationNote: r.recertificationNote || null, cpdEligible: r.cpdEligible,
        cpdValue: r.cpdEligible ? r.cpdValue : null, cpdUnit: r.cpdUnit, cpdAccreditationNote: r.cpdAccreditationNote || null, isMandatory: r.isMandatory, enrolmentRule: r.enrolmentRule,
      },
    });
    await tx.coursePrerequisite.deleteMany({ where: { courseId } });
    if (r.prerequisiteIds.length) await tx.coursePrerequisite.createMany({ data: r.prerequisiteIds.map((prerequisiteId) => ({ courseId, prerequisiteId })) });
    await tx.courseInstructor.deleteMany({ where: { courseId } });
    if (r.instructorIds.length) await tx.courseInstructor.createMany({ data: r.instructorIds.map((userId, i) => ({ courseId, userId, isLead: i === 0 })) });
    await tx.courseCompetency.deleteMany({ where: { courseId } });
    if (r.competencies.length) await tx.courseCompetency.createMany({ data: r.competencies.map((c) => ({ courseId, ...c })) });
  });
  if (course.status === "PUBLISHED") {
    const errs = await publishErrors(courseId);
    if (errs.length) throw invalid(`These rules cannot be satisfied by the published course: ${errs.join(" ")}`);
  }
  await audit(actor.id, "course.rules.update", "course", courseId, { ...r, competencies: r.competencies.length } as unknown as Prisma.InputJsonValue);
}

export async function publishErrors(courseId: string) {
  const c = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, include: { modules: { include: { lessons: true } }, assessments: { include: { _count: { select: { questions: true } } } } } });
  const lessons = c.modules.flatMap((m) => m.lessons);
  const errs = validateCompletionConfig(c, {
    requiredLessons: lessons.filter((l) => l.isRequired).length,
    finalAssessments: c.assessments.filter((a) => a.isFinal && a._count.questions > 0).length,
    assignmentLessons: lessons.filter((l) => l.type === "ASSIGNMENT").length,
    acknowledgementText: c.acknowledgementText,
  });
  if (!lessons.length) errs.push("Add at least one lesson.");
  if (c.assessments.some((a) => a._count.questions === 0)) errs.push("Every assessment needs at least one question.");
  if (lessons.some((l) => l.type === "ASSESSMENT" && !l.assessmentId)) errs.push("An assessment lesson is not linked to an assessment.");
  return errs;
}

export async function setCourseStatus(actor: Actor, courseId: string, to: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED") {
  const c = await prisma.course.findUnique({ where: { id: courseId } });
  if (!c) throw notFound("Course");
  if (to === "IN_REVIEW") await assertCanManageCourse(actor, courseId);
  else assertCan(actor, "course.manage");
  if (to === "PUBLISHED") {
    const errs = await publishErrors(courseId);
    if (errs.length) throw invalid(`The course cannot be published yet: ${errs.join(" ")}`);
  }
  if (to === "ARCHIVED") {
    const active = await prisma.enrollment.count({ where: { courseId, status: "ACTIVE" } });
    const mandatory = await prisma.learningAssignment.count({ where: { courseId, status: "ASSIGNED" } });
    if (mandatory) throw invalid(`Cancel or complete the ${mandatory} open assignment(s) before archiving.`);
    if (active) await audit(actor.id, "course.archive.with-active", "course", courseId, { active });
  }
  await prisma.course.update({
    where: { id: courseId },
    data: { status: to, publishedAt: to === "PUBLISHED" ? c.publishedAt ?? new Date() : c.publishedAt, archivedAt: to === "ARCHIVED" ? new Date() : null },
  });
  await audit(actor.id, `course.status.${to.toLowerCase()}`, "course", courseId, { from: c.status });
}

// ───── Modules & lessons

export async function addModule(actor: Actor, courseId: string, title: string, description: string) {
  await assertCanManageCourse(actor, courseId);
  if (title.trim().length < 3) throw invalid("Enter a module title.");
  const n = await prisma.courseModule.count({ where: { courseId } });
  return prisma.courseModule.create({ data: { courseId, title: title.trim(), description: description.trim() || null, sortOrder: n } });
}

async function moduleCourse(moduleId: string) {
  const m = await prisma.courseModule.findUnique({ where: { id: moduleId } });
  if (!m) throw notFound("Module");
  return m;
}

export async function updateModule(actor: Actor, moduleId: string, title: string, description: string) {
  const m = await moduleCourse(moduleId);
  await assertCanManageCourse(actor, m.courseId);
  await prisma.courseModule.update({ where: { id: moduleId }, data: { title: title.trim(), description: description.trim() || null } });
}

export async function deleteModule(actor: Actor, moduleId: string) {
  const m = await moduleCourse(moduleId);
  await assertCanManageCourse(actor, m.courseId);
  const progress = await prisma.lessonProgress.count({ where: { lesson: { moduleId } } });
  if (progress) throw invalid("Learners have progress in this module. Unpublish lessons by editing them instead of deleting.");
  await prisma.courseModule.delete({ where: { id: moduleId } });
}

export async function moveModule(actor: Actor, moduleId: string, dir: -1 | 1) {
  const m = await moduleCourse(moduleId);
  await assertCanManageCourse(actor, m.courseId);
  const all = await prisma.courseModule.findMany({ where: { courseId: m.courseId }, orderBy: { sortOrder: "asc" } });
  const i = all.findIndex((x) => x.id === moduleId);
  const j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((x, k) => prisma.courseModule.update({ where: { id: x.id }, data: { sortOrder: k } })));
}

export const lessonSchema = z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(["TEXT", "VIDEO", "PDF", "DOCUMENT", "EXTERNAL", "ASSESSMENT", "ASSIGNMENT"]),
  body: z.string().max(40000).optional().default(""),
  videoUrl: z.string().url().optional().or(z.literal("")),
  externalUrl: z.string().url().optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(1).max(1440).nullable().optional(),
  isRequired: z.boolean().default(true),
  assessmentId: z.string().optional().nullable(),
});

export async function saveLesson(actor: Actor, moduleId: string, lessonId: string | null, raw: unknown) {
  const m = await moduleCourse(moduleId);
  await assertCanManageCourse(actor, m.courseId);
  const l = lessonSchema.parse(raw);
  if (l.type === "VIDEO" && !l.videoUrl) throw invalid("Provide the video URL (an approved, access-controlled streaming source).");
  if (l.type === "EXTERNAL" && !l.externalUrl) throw invalid("Provide the external resource URL.");
  if (l.type === "ASSESSMENT") {
    if (!l.assessmentId) throw invalid("Choose the assessment for this lesson.");
    const a = await prisma.assessment.findUnique({ where: { id: l.assessmentId }, include: { lesson: true } });
    if (!a || a.courseId !== m.courseId) throw invalid("The assessment must belong to this course.");
    if (a.lesson && a.lesson.id !== lessonId) throw invalid("That assessment is already used by another lesson.");
  }
  const data = {
    title: l.title, type: l.type, body: l.body || null, videoUrl: l.videoUrl || null, externalUrl: l.externalUrl || null,
    durationMinutes: l.durationMinutes ?? null, isRequired: l.isRequired, assessmentId: l.type === "ASSESSMENT" ? l.assessmentId : null,
  };
  if (lessonId) {
    const existing = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!existing || existing.moduleId !== moduleId) throw notFound("Lesson");
    return prisma.lesson.update({ where: { id: lessonId }, data });
  }
  const n = await prisma.lesson.count({ where: { moduleId } });
  return prisma.lesson.create({ data: { ...data, moduleId, sortOrder: n } });
}

export async function deleteLesson(actor: Actor, lessonId: string) {
  const l = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true, _count: { select: { progress: true, submissions: true } } } });
  if (!l) throw notFound("Lesson");
  await assertCanManageCourse(actor, l.module.courseId);
  if (l._count.progress || l._count.submissions) throw invalid("Learners have records for this lesson; mark it optional instead of deleting it.");
  await prisma.lesson.delete({ where: { id: lessonId } });
}

export async function moveLesson(actor: Actor, lessonId: string, dir: -1 | 1) {
  const l = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!l) throw notFound("Lesson");
  await assertCanManageCourse(actor, l.module.courseId);
  const all = await prisma.lesson.findMany({ where: { moduleId: l.moduleId }, orderBy: { sortOrder: "asc" } });
  const i = all.findIndex((x) => x.id === lessonId);
  const j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((x, k) => prisma.lesson.update({ where: { id: x.id }, data: { sortOrder: k } })));
}

export async function addLessonResource(actor: Actor, lessonId: string, fileId: string, label: string) {
  const l = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!l) throw notFound("Lesson");
  await assertCanManageCourse(actor, l.module.courseId);
  return prisma.lessonResource.create({ data: { lessonId, fileId, label: label.trim() || "Lesson material" } });
}

export async function removeLessonResource(actor: Actor, resourceId: string) {
  const r = await prisma.lessonResource.findUnique({ where: { id: resourceId }, include: { lesson: { include: { module: true } } } });
  if (!r) throw notFound("Resource");
  await assertCanManageCourse(actor, r.lesson.module.courseId);
  await prisma.lessonResource.delete({ where: { id: resourceId } });
}

// ───── Assessments

export const assessmentSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  passingScore: z.coerce.number().int().min(1).max(100),
  maxAttempts: z.coerce.number().int().min(0).max(20),
  timeLimitMinutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
  isFinal: z.boolean(),
});

export async function saveAssessment(actor: Actor, courseId: string, assessmentId: string | null, raw: unknown) {
  await assertCanManageCourse(actor, courseId);
  const a = assessmentSchema.parse(raw);
  if (assessmentId) {
    const ex = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!ex || ex.courseId !== courseId) throw notFound("Assessment");
    const attempts = await prisma.assessmentAttempt.count({ where: { assessmentId } });
    if (attempts && a.passingScore !== ex.passingScore) await audit(actor.id, "assessment.passmark.change", "assessment", assessmentId, { from: ex.passingScore, to: a.passingScore, existingAttempts: attempts });
    return prisma.assessment.update({ where: { id: assessmentId }, data: { ...a, description: a.description || null, timeLimitMinutes: a.timeLimitMinutes ?? null } });
  }
  return prisma.assessment.create({ data: { ...a, courseId, description: a.description || null, timeLimitMinutes: a.timeLimitMinutes ?? null } });
}

export const questionSchema = z.object({
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]),
  prompt: z.string().trim().min(5).max(2000),
  points: z.coerce.number().int().min(1).max(20),
  options: z.array(z.string().trim()).default([]),
  correctIndex: z.coerce.number().int().min(0).optional(),
  correctBoolean: z.enum(["true", "false"]).optional(),
  guidance: z.string().trim().max(1000).optional().default(""),
});

export async function saveQuestion(actor: Actor, assessmentId: string, questionId: string | null, raw: unknown) {
  const a = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!a) throw notFound("Assessment");
  await assertCanManageCourse(actor, a.courseId);
  const q = questionSchema.parse(raw);
  const opts = q.options.filter(Boolean);
  if (q.type === "MULTIPLE_CHOICE") {
    if (opts.length < 2) throw invalid("Provide at least two options.");
    if (q.correctIndex == null || q.correctIndex >= opts.length) throw invalid("Choose the correct option.");
  }
  if (q.type === "TRUE_FALSE" && !q.correctBoolean) throw invalid("Choose the correct answer.");
  if (questionId) {
    const answered = await prisma.assessmentResponse.count({ where: { questionId } });
    if (answered) throw invalid("This question has recorded responses. Add a new question and remove this one from future attempts instead.");
  }
  const data = {
    type: q.type, prompt: q.prompt, points: q.points,
    options: q.type === "MULTIPLE_CHOICE" ? opts.map((text, i) => ({ id: String.fromCharCode(97 + i), text })) : Prisma.JsonNull,
    correctOptionId: q.type === "MULTIPLE_CHOICE" ? String.fromCharCode(97 + q.correctIndex!) : null,
    correctBoolean: q.type === "TRUE_FALSE" ? q.correctBoolean === "true" : null,
    guidance: q.guidance || null,
  };
  if (questionId) return prisma.assessmentQuestion.update({ where: { id: questionId }, data });
  const n = await prisma.assessmentQuestion.count({ where: { assessmentId } });
  return prisma.assessmentQuestion.create({ data: { ...data, assessmentId, sortOrder: n } });
}

export async function deleteQuestion(actor: Actor, questionId: string) {
  const q = await prisma.assessmentQuestion.findUnique({ where: { id: questionId }, include: { assessment: true, _count: { select: { responses: true } } } });
  if (!q) throw notFound("Question");
  await assertCanManageCourse(actor, q.assessment.courseId);
  if (q._count.responses) throw forbidden("Questions with recorded responses are part of the assessment history and cannot be deleted.");
  await prisma.assessmentQuestion.delete({ where: { id: questionId } });
}
