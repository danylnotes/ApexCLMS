import { z } from "zod";
import { prisma } from "../db";
import { conflict, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertCan } from "../policy";
import { audit } from "../audit";
import { notify } from "../notify";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

// ───── Learning paths

export const pathSchema = z.object({
  code: z.string().trim().min(3).max(20),
  title: z.string().trim().min(4).max(200),
  summary: z.string().trim().min(10).max(1000),
  targetAudience: z.string().trim().min(5).max(500),
  entryRequirements: z.string().trim().max(500).optional().default(""),
  completionCriteria: z.string().trim().min(5).max(1000),
  estimatedDurationWeeks: z.coerce.number().int().min(1).max(260).nullable().optional(),
  cpdEligible: z.boolean(),
  targetJobRoleId: z.string().optional().nullable(),
  competencyIds: z.array(z.string()).default([]),
});

async function recomputePathHours(pathId: string) {
  const items = await prisma.learningPathItem.findMany({ where: { pathId }, include: { course: { select: { estimatedHours: true } } } });
  await prisma.learningPath.update({ where: { id: pathId }, data: { expectedHours: items.reduce((s, i) => s + Number(i.course.estimatedHours), 0) } });
}

export async function savePath(actor: Actor, pathId: string | null, raw: unknown) {
  assertCan(actor, "course.manage");
  const p = pathSchema.parse(raw);
  const data = { code: p.code, title: p.title, summary: p.summary, targetAudience: p.targetAudience, entryRequirements: p.entryRequirements || null, completionCriteria: p.completionCriteria, estimatedDurationWeeks: p.estimatedDurationWeeks ?? null, cpdEligible: p.cpdEligible, targetJobRoleId: p.targetJobRoleId || null };
  const dup = await prisma.learningPath.findFirst({ where: { code: p.code, ...(pathId ? { id: { not: pathId } } : {}) } });
  if (dup) throw conflict("A learning path with this code already exists.");
  const path = pathId
    ? await prisma.learningPath.update({ where: { id: pathId }, data })
    : await prisma.learningPath.create({ data: { ...data, slug: slugify(p.title), expectedHours: 0 } });
  await prisma.learningPathCompetency.deleteMany({ where: { pathId: path.id } });
  if (p.competencyIds.length) await prisma.learningPathCompetency.createMany({ data: p.competencyIds.map((competencyId) => ({ pathId: path.id, competencyId })) });
  await audit(actor.id, pathId ? "path.update" : "path.create", "learning_path", path.id);
  return path;
}

export async function addPathItem(actor: Actor, pathId: string, courseId: string, isRequired: boolean, prerequisiteItemId: string | null) {
  assertCan(actor, "course.manage");
  if (await prisma.learningPathItem.findUnique({ where: { pathId_courseId: { pathId, courseId } } })) throw conflict("The course is already in this path.");
  if (prerequisiteItemId) {
    const pre = await prisma.learningPathItem.findUnique({ where: { id: prerequisiteItemId } });
    if (!pre || pre.pathId !== pathId) throw invalid("The prerequisite must be an item in this path.");
  }
  const n = await prisma.learningPathItem.count({ where: { pathId } });
  await prisma.learningPathItem.create({ data: { pathId, courseId, isRequired, sortOrder: n, prerequisiteItemId } });
  await recomputePathHours(pathId);
}

export async function removePathItem(actor: Actor, itemId: string) {
  assertCan(actor, "course.manage");
  const it = await prisma.learningPathItem.findUnique({ where: { id: itemId } });
  if (!it) throw notFound("Path item");
  await prisma.learningPathItem.updateMany({ where: { prerequisiteItemId: itemId }, data: { prerequisiteItemId: null } });
  await prisma.learningPathItem.delete({ where: { id: itemId } });
  await recomputePathHours(it.pathId);
}

export async function setPathStatus(actor: Actor, pathId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  assertCan(actor, "course.manage");
  const p = await prisma.learningPath.findUnique({ where: { id: pathId }, include: { items: { include: { course: true } } } });
  if (!p) throw notFound("Learning path");
  if (status === "PUBLISHED") {
    if (!p.items.some((i) => i.isRequired)) throw invalid("Add at least one required course before publishing.");
    const unpublished = p.items.filter((i) => i.course.status !== "PUBLISHED");
    if (unpublished.length) throw invalid(`These courses are not published: ${unpublished.map((i) => i.course.code).join(", ")}.`);
  }
  await prisma.learningPath.update({ where: { id: pathId }, data: { status } });
  await audit(actor.id, `path.status.${status.toLowerCase()}`, "learning_path", pathId);
}

// ───── Webinars

export const webinarSchema = z.object({
  code: z.string().trim().min(3).max(20),
  title: z.string().trim().min(5).max(200),
  synopsis: z.string().trim().min(10).max(600),
  overview: z.string().trim().min(10).max(6000),
  objectives: z.string().max(3000).default(""),
  speakerName: z.string().trim().min(2).max(120),
  speakerTitle: z.string().trim().max(200).optional().default(""),
  speakerBio: z.string().trim().max(2000).optional().default(""),
  categoryId: z.string().optional().nullable(),
  startsAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(10).max(600),
  timeZone: z.string().trim().min(2).max(60),
  capacity: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  registrationRequirements: z.string().trim().max(1000).optional().default(""),
  minAttendanceMinutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
  cpdEligible: z.boolean(),
  cpdValue: z.coerce.number().min(0).max(50).nullable().optional(),
  meetingProvider: z.enum(["NONE", "MICROSOFT_TEAMS", "ZOOM", "OTHER"]),
  meetingUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "SCHEDULED"]).default("SCHEDULED"),
});

export async function saveWebinar(actor: Actor, webinarId: string | null, raw: unknown) {
  assertCan(actor, "webinar.manage");
  const w = webinarSchema.parse(raw);
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: w.timeZone });
  } catch {
    throw invalid("Enter a valid IANA time zone, e.g. Asia/Baghdad or Europe/London.");
  }
  if (w.cpdEligible && !(w.cpdValue && w.cpdValue > 0)) throw invalid("Enter the CPD value for a CPD-eligible webinar.");
  if (w.minAttendanceMinutes && w.minAttendanceMinutes > w.durationMinutes) throw invalid("Minimum attendance cannot exceed the duration.");
  const dup = await prisma.webinar.findFirst({ where: { code: w.code, ...(webinarId ? { id: { not: webinarId } } : {}) } });
  if (dup) throw conflict("A webinar with this code already exists.");
  const data = {
    code: w.code, title: w.title, synopsis: w.synopsis, overview: w.overview, objectives: lines(w.objectives), speakerName: w.speakerName, speakerTitle: w.speakerTitle || null,
    speakerBio: w.speakerBio || null, categoryId: w.categoryId || null, startsAt: w.startsAt, durationMinutes: w.durationMinutes, timeZone: w.timeZone, capacity: w.capacity ?? null,
    registrationRequirements: w.registrationRequirements || null, minAttendanceMinutes: w.minAttendanceMinutes ?? null, cpdEligible: w.cpdEligible, cpdValue: w.cpdEligible ? w.cpdValue : null,
    meetingProvider: w.meetingProvider, meetingUrl: w.meetingUrl || null,
  };
  if (webinarId) {
    const ex = await prisma.webinar.findUnique({ where: { id: webinarId } });
    if (!ex) throw notFound("Webinar");
    if (ex.status === "CANCELLED" || ex.status === "COMPLETED") throw invalid("Cancelled or completed webinars cannot be edited.");
    const r = await prisma.webinar.update({ where: { id: webinarId }, data: { ...data, status: w.status } });
    await audit(actor.id, "webinar.update", "webinar", webinarId);
    return r;
  }
  const r = await prisma.webinar.create({ data: { ...data, status: w.status, slug: `${slugify(w.title)}-${w.code.toLowerCase()}` } });
  await audit(actor.id, "webinar.create", "webinar", r.id);
  return r;
}

export async function cancelWebinar(actor: Actor, webinarId: string, reason: string) {
  assertCan(actor, "webinar.manage");
  if (!reason.trim()) throw invalid("Give a cancellation reason; it is shown to registered employees.");
  const w = await prisma.webinar.findUnique({ where: { id: webinarId }, include: { registrations: { where: { status: { in: ["REGISTERED", "WAITLISTED"] } } } } });
  if (!w) throw notFound("Webinar");
  if (w.status === "COMPLETED") throw invalid("A completed webinar cannot be cancelled.");
  await prisma.webinar.update({ where: { id: webinarId }, data: { status: "CANCELLED", cancellationReason: reason.trim() } });
  for (const r of w.registrations) await notify(r.userId, { type: "SYSTEM", title: "Webinar cancelled", body: `${w.title}: ${reason.trim()}`, link: `/webinars/${w.slug}`, dedupeKey: `webinar-cancel:${w.id}` });
  await audit(actor.id, "webinar.cancel", "webinar", webinarId, { notified: w.registrations.length });
}

export async function addRecording(actor: Actor, webinarId: string, title: string, url: string, durationMinutes: number | null, availableUntil: Date | null) {
  assertCan(actor, "webinar.manage");
  z.string().url().parse(url);
  if (!title.trim()) throw invalid("Enter a recording title.");
  await prisma.webinarRecording.create({ data: { webinarId, title: title.trim(), url, durationMinutes, availableUntil } });
  await audit(actor.id, "webinar.recording.add", "webinar", webinarId);
}

// ───── Competency framework

export async function updateFramework(actor: Actor, frameworkId: string, data: { name: string; version: string; description: string; status: "DRAFT" | "ACTIVE" | "RETIRED"; allowCourseCompletionAsCompetence: boolean }) {
  assertCan(actor, "competency.manage");
  await prisma.competencyFramework.update({ where: { id: frameworkId }, data: { ...data, description: data.description || null } });
  await audit(actor.id, "framework.update", "competency_framework", frameworkId, data);
}

export async function saveLevel(actor: Actor, frameworkId: string, level: number, name: string, description: string) {
  assertCan(actor, "competency.manage");
  if (level < 1 || level > 10 || !name.trim()) throw invalid("Enter a level number (1–10) and name.");
  await prisma.proficiencyLevel.upsert({ where: { frameworkId_level: { frameworkId, level } }, create: { frameworkId, level, name: name.trim(), description: description.trim() }, update: { name: name.trim(), description: description.trim() } });
  await audit(actor.id, "framework.level.save", "competency_framework", frameworkId, { level });
}

export async function saveDomain(actor: Actor, frameworkId: string, name: string) {
  assertCan(actor, "competency.manage");
  if (name.trim().length < 3) throw invalid("Enter a domain name.");
  const n = await prisma.competencyDomain.count({ where: { frameworkId } });
  await prisma.competencyDomain.create({ data: { frameworkId, name: name.trim(), sortOrder: n } });
}

export const competencySchema = z.object({
  domainId: z.string(),
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(2000),
  evidenceRequirements: z.string().trim().max(2000).optional().default(""),
  assessmentCriteria: z.string().trim().max(2000).optional().default(""),
  reassessmentMonths: z.coerce.number().int().min(1).max(120).nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function saveCompetency(actor: Actor, id: string | null, raw: unknown) {
  assertCan(actor, "competency.manage");
  const c = competencySchema.parse(raw);
  const dup = await prisma.competency.findFirst({ where: { code: c.code, ...(id ? { id: { not: id } } : {}) } });
  if (dup) throw conflict("A competency with this code already exists.");
  const data = { ...c, evidenceRequirements: c.evidenceRequirements || null, assessmentCriteria: c.assessmentCriteria || null, reassessmentMonths: c.reassessmentMonths ?? null };
  const r = id ? await prisma.competency.update({ where: { id }, data }) : await prisma.competency.create({ data });
  await audit(actor.id, id ? "competency.update" : "competency.create", "competency", r.id);
}

export async function setRoleRequirement(actor: Actor, jobRoleId: string, competencyId: string, requiredLevel: number | null, isCritical: boolean) {
  assertCan(actor, "competency.manage");
  if (requiredLevel == null || requiredLevel === 0) await prisma.roleCompetencyRequirement.deleteMany({ where: { jobRoleId, competencyId } });
  else await prisma.roleCompetencyRequirement.upsert({ where: { jobRoleId_competencyId: { jobRoleId, competencyId } }, create: { jobRoleId, competencyId, requiredLevel, isCritical }, update: { requiredLevel, isCritical } });
  await audit(actor.id, "role.requirement.set", "job_role", jobRoleId, { competencyId, requiredLevel, isCritical });
}

// ───── CPD configuration

export const policySchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional().default(""),
  professionalBody: z.string().trim().max(200).optional().default(""),
  unit: z.enum(["HOURS", "POINTS"]),
  targetPerPeriod: z.coerce.number().min(0).max(500).nullable().optional(),
  pointsPerHour: z.coerce.number().min(0.1).max(10).nullable().optional(),
  maxPerActivity: z.coerce.number().min(0.5).max(200).nullable().optional(),
  eligibleTypes: z.array(z.string()).default([]),
  autoApproveVerifiedInternal: z.boolean(),
  isActive: z.boolean().default(true),
});

export async function savePolicy(actor: Actor, id: string | null, raw: unknown) {
  assertCan(actor, "cpd.configure");
  const p = policySchema.parse(raw);
  const data = { ...p, description: p.description || null, professionalBody: p.professionalBody || null, targetPerPeriod: p.targetPerPeriod ?? null, pointsPerHour: p.unit === "POINTS" ? p.pointsPerHour ?? 1 : null, maxPerActivity: p.maxPerActivity ?? null, eligibleTypes: p.eligibleTypes as never };
  const r = id ? await prisma.cpdPolicy.update({ where: { id }, data }) : await prisma.cpdPolicy.create({ data });
  await audit(actor.id, id ? "cpd.policy.update" : "cpd.policy.create", "cpd_policy", r.id, { target: p.targetPerPeriod ?? null, unit: p.unit });
}

export async function savePeriod(actor: Actor, name: string, start: Date, end: Date, isCurrent: boolean) {
  assertCan(actor, "cpd.configure");
  if (!(end > start)) throw invalid("The end date must be after the start date.");
  await prisma.$transaction(async (tx) => {
    if (isCurrent) await tx.reportingPeriod.updateMany({ data: { isCurrent: false } });
    await tx.reportingPeriod.upsert({ where: { name }, create: { name, startDate: start, endDate: end, isCurrent }, update: { startDate: start, endDate: end, isCurrent } });
  });
  await audit(actor.id, "reporting.period.save", "reporting_period", name);
}

// ───── Organisation reference data

export async function saveDepartment(actor: Actor, code: string, name: string, businessUnitId: string | null) {
  assertCan(actor, "user.manage");
  if (!/^[A-Z0-9]{2,10}$/.test(code)) throw invalid("Department codes are 2–10 upper-case letters or digits.");
  await prisma.department.upsert({ where: { code }, create: { code, name: name.trim(), businessUnitId }, update: { name: name.trim(), businessUnitId } });
  await audit(actor.id, "department.save", "department", code);
}

export async function saveBusinessUnit(actor: Actor, code: string, name: string) {
  assertCan(actor, "user.manage");
  if (!/^[A-Z0-9]{2,10}$/.test(code)) throw invalid("Business unit codes are 2–10 upper-case letters or digits.");
  await prisma.businessUnit.upsert({ where: { code }, create: { code, name: name.trim() }, update: { name: name.trim() } });
}

export async function saveJobRole(actor: Actor, code: string, title: string, departmentId: string | null, careerTrack: string, grade: number | null, minYears: number | null) {
  assertCan(actor, "user.manage");
  if (!/^[A-Z0-9-]{2,12}$/.test(code)) throw invalid("Job role codes are 2–12 upper-case letters, digits or hyphens.");
  await prisma.jobRole.upsert({ where: { code }, create: { code, title: title.trim(), departmentId, careerTrack: careerTrack || null, grade, minYearsExperience: minYears }, update: { title: title.trim(), departmentId, careerTrack: careerTrack || null, grade, minYearsExperience: minYears } });
  await audit(actor.id, "jobrole.save", "job_role", code);
}

export async function saveCategory(actor: Actor, id: string | null, name: string, description: string, isActive: boolean) {
  assertCan(actor, "course.manage");
  if (name.trim().length < 3) throw invalid("Enter a category name.");
  if (id) await prisma.courseCategory.update({ where: { id }, data: { name: name.trim(), description: description || null, isActive } });
  else {
    const n = await prisma.courseCategory.count();
    await prisma.courseCategory.create({ data: { name: name.trim(), slug: slugify(name), description: description || null, sortOrder: n } });
  }
  await audit(actor.id, "category.save", "course_category", id ?? name);
}

// ───── Certificates & credentials

export async function saveTemplate(actor: Actor, id: string | null, d: { name: string; heading: string; bodyText: string; signatoryName: string; signatoryTitle: string; isDefault: boolean }) {
  assertCan(actor, "certificate.manage");
  if (!d.name.trim() || !d.heading.trim() || !d.signatoryName.trim()) throw invalid("Name, heading and signatory are required.");
  await prisma.$transaction(async (tx) => {
    if (d.isDefault) await tx.certificateTemplate.updateMany({ data: { isDefault: false } });
    if (id) await tx.certificateTemplate.update({ where: { id }, data: d });
    else await tx.certificateTemplate.create({ data: d });
  });
  await audit(actor.id, "certificate.template.save", "certificate_template", id);
}

export async function revokeCertificate(actor: Actor, id: string, reason: string) {
  assertCan(actor, "certificate.manage");
  if (!reason.trim()) throw invalid("A revocation reason is required.");
  const c = await prisma.certificate.findUnique({ where: { id } });
  if (!c || c.status === "REVOKED") throw notFound("Certificate");
  await prisma.certificate.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason.trim() } });
  await audit(actor.id, "certificate.revoke", "certificate", id, { reason: reason.trim() });
  await notify(c.userId, { type: "SYSTEM", title: "Certificate revoked", body: `Certificate ${c.serial} has been revoked: ${reason.trim()}`, link: "/certificates", dedupeKey: `cert-revoke:${id}` });
}

export async function addCredential(actor: Actor, userId: string, d: { name: string; issuer: string; credentialNo: string; issuedOn: Date; expiresOn: Date | null; verify: boolean }) {
  assertCan(actor, "user.manage");
  if (!d.name.trim() || !d.issuer.trim()) throw invalid("Name and issuer are required.");
  await prisma.credential.create({ data: { userId, name: d.name.trim(), issuer: d.issuer.trim(), credentialNo: d.credentialNo || null, issuedOn: d.issuedOn, expiresOn: d.expiresOn, verifiedAt: d.verify ? new Date() : null, verifiedById: d.verify ? actor.id : null } });
  await audit(actor.id, "credential.add", "user", userId, { name: d.name, verified: d.verify });
}
