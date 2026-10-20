/**
 * Demonstration seed. Every person, course and record created here is FICTIONAL and flagged
 * (users.isDemo = true, emails on the reserved .test domain). The seed truncates all data and
 * refuses to run in production unless ALLOW_DEMO_SEED=true is set explicitly.
 */
import { PrismaClient, Prisma, type CpdClaimStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ROLE_DEFAULTS, PERMISSIONS } from "../src/server/permissions";
import { ALL_COURSES } from "./seed/courses";
import { BUSINESS_UNITS, CATEGORIES, COURSE_AUDIENCES, DEPARTMENTS, DOMAINS, EARLIER_LEVELS, JOB_ROLES, LEARNING_PATHS, LEVELS, PATHWAYS, PEOPLE, PENDING_PROMOTION } from "./seed/org";

const prisma = new PrismaClient();
export const DEMO_PASSWORD = "Demo#Apex2026!";

const NOW = new Date();
const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);
const daysAhead = (d: number) => new Date(NOW.getTime() + d * DAY);
const addMonths = (d: Date, m: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
};

// Deterministic PRNG so the demonstration data is reproducible.
let seedState = 20261019;
const rand = () => {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a: number, b: number) => Math.round(a + rand() * (b - a));

async function truncateAll() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

async function makePdf(title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 0, y: 792, width: 595, height: 50, color: rgb(0.09, 0.15, 0.27) });
  page.drawText("Apex CLMS — Reference sheet (fictional demonstration content)", { x: 40, y: 812, size: 9, font: sans, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 40, y: 740, size: 20, font: serif, color: rgb(0.09, 0.15, 0.27) });
  let y = 700;
  for (const l of lines) {
    page.drawText(l, { x: 40, y, size: 11, font: sans, color: rgb(0.15, 0.15, 0.17) });
    y -= 20;
  }
  return Buffer.from(await doc.save());
}

async function storeFile(buf: Buffer, name: string, uploadedById: string, purpose: "COURSE_MATERIAL" | "CPD_EVIDENCE") {
  const key = `seed/${randomBytes(12).toString("hex")}`;
  const abs = path.join(path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage"), key);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf);
  return prisma.storedFile.create({
    data: { storageKey: key, originalName: name, mimeType: "application/pdf", sizeBytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), purpose, uploadedById },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed demonstration data in production. Set ALLOW_DEMO_SEED=true for an isolated demo environment only.");
  }
  console.log("Seeding fictional demonstration data…");
  await truncateAll();

  // ── Permissions & roles
  for (const [key, def] of Object.entries(PERMISSIONS)) await prisma.permission.create({ data: { key, description: def.description, group: def.group } });
  const perms = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));
  const roles = new Map<string, string>();
  for (const [key, def] of Object.entries(ROLE_DEFAULTS)) {
    const r = await prisma.role.create({ data: { key, name: def.name, description: def.description, permissions: { create: def.permissions.map((p) => ({ permissionId: perms.get(p)! })) } } });
    roles.set(key, r.id);
  }

  // ── Organisation
  const bus = new Map<string, string>();
  for (const b of BUSINESS_UNITS) bus.set(b.code, (await prisma.businessUnit.create({ data: b })).id);
  const depts = new Map<string, string>();
  for (const d of DEPARTMENTS) depts.set(d.code, (await prisma.department.create({ data: { code: d.code, name: d.name, businessUnitId: bus.get(d.bu) } })).id);
  const cats = new Map<string, string>();
  for (const [i, [slug, name]] of CATEGORIES.entries()) cats.set(slug, (await prisma.courseCategory.create({ data: { slug, name, sortOrder: i } })).id);

  // ── Competency framework
  const fw = await prisma.competencyFramework.create({
    data: {
      name: "APEX Technical & Professional Competency Framework",
      version: "2.1",
      status: "ACTIVE",
      description: "Fictional demonstration framework covering technical, operational, safety, leadership and analytical competencies. Course completion is recorded as knowledge evidence only; demonstrated competence requires workplace assessment.",
      allowCourseCompletionAsCompetence: false,
      levels: { create: LEVELS.map(([level, name, description]) => ({ level, name, description })) },
    },
  });
  const comps = new Map<string, string>();
  for (const [i, d] of DOMAINS.entries()) {
    const dom = await prisma.competencyDomain.create({ data: { frameworkId: fw.id, name: d.name, sortOrder: i } });
    for (const c of d.competencies) {
      const row = await prisma.competency.create({
        data: {
          domainId: dom.id,
          code: c.code,
          name: c.name,
          description: c.description,
          reassessmentMonths: c.reassess ?? null,
          evidenceRequirements: "Workplace observation, practical demonstration or supervisor evaluation against the assessment criteria. Course completion provides supporting knowledge evidence.",
          assessmentCriteria: `Performs the competency "${c.name.toLowerCase()}" consistently at the required proficiency level in the normal operating context.`,
        },
      });
      comps.set(c.code, row.id);
    }
  }

  // ── CPD policies & reporting periods
  const y = NOW.getUTCFullYear();
  const periodNow = await prisma.reportingPeriod.create({ data: { name: String(y), startDate: new Date(Date.UTC(y, 0, 1)), endDate: new Date(Date.UTC(y, 11, 31, 23, 59, 59)), isCurrent: true } });
  const periodPrev = await prisma.reportingPeriod.create({ data: { name: String(y - 1), startDate: new Date(Date.UTC(y - 1, 0, 1)), endDate: new Date(Date.UTC(y - 1, 11, 31, 23, 59, 59)) } });
  const periodFor = (d: Date) => (d.getUTCFullYear() === y ? periodNow.id : d.getUTCFullYear() === y - 1 ? periodPrev.id : null);
  const policies = {
    ENG: await prisma.cpdPolicy.create({ data: { name: "Engineering Professional Registration", description: "For engineers maintaining professional registration. Target set to align with typical professional-body expectations; confirm your own body's requirement.", professionalBody: "Configurable — engineering institution of registration", unit: "HOURS", targetPerPeriod: 30, maxPerActivity: 20, eligibleTypes: [], autoApproveVerifiedInternal: false } }),
    TECH: await prisma.cpdPolicy.create({ data: { name: "Operations & Technical Staff CPD", description: "Internal development record for operations and maintenance technical staff, measured in points.", unit: "POINTS", targetPerPeriod: 20, pointsPerHour: 1, maxPerActivity: 8, eligibleTypes: [], autoApproveVerifiedInternal: true } }),
    LEAD: await prisma.cpdPolicy.create({ data: { name: "Corporate Functions Development Record", description: "Record-only policy for corporate functions. No target is applied.", unit: "HOURS", targetPerPeriod: null, eligibleTypes: [] } }),
  };

  // ── Job roles, requirements, pathways
  const jobRoles = new Map<string, string>();
  for (const r of JOB_ROLES) {
    const jr = await prisma.jobRole.create({ data: { code: r.code, title: r.title, departmentId: depts.get(r.dept), careerTrack: r.track, grade: r.grade, minYearsExperience: r.years ?? null } });
    jobRoles.set(r.code, jr.id);
    for (const [code, level, critical] of r.reqs) await prisma.roleCompetencyRequirement.create({ data: { jobRoleId: jr.id, competencyId: comps.get(code)!, requiredLevel: level, isCritical: !!critical } });
  }
  for (const [from, to, years] of PATHWAYS) await prisma.careerPathway.create({ data: { fromRoleId: jobRoles.get(from)!, toRoleId: jobRoles.get(to)!, typicalYears: years } });

  // ── People
  const pwHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = new Map<string, string>();
  for (const p of PEOPLE) {
    const u = await prisma.user.create({
      data: {
        email: p.email,
        name: p.name,
        passwordHash: pwHash,
        status: "ACTIVE",
        emailVerifiedAt: daysAgo(p.hiredMonthsAgo * 30 + 1),
        isDemo: true,
        lastLoginAt: daysAgo(between(0, 6)),
        roles: { create: p.roles.map((r) => ({ roleId: roles.get(r)! })) },
        profile: {
          create: {
            employeeNumber: p.employeeNo,
            jobRoleId: jobRoles.get(p.role),
            targetJobRoleId: p.target ? jobRoles.get(p.target) : null,
            departmentId: depts.get(p.dept),
            businessUnitId: bus.get(DEPARTMENTS.find((d) => d.code === p.dept)!.bu),
            location: p.location,
            hireDate: p.hiredMonthsAgo === 0 ? daysAgo(21) : addMonths(NOW, -p.hiredMonthsAgo),
            learningProgramme: p.programme ?? null,
            cpdPolicyId: p.cpdPolicy ? policies[p.cpdPolicy as keyof typeof policies].id : null,
            bio: p.persona ? `Demonstration persona: ${p.persona}.` : null,
          },
        },
      },
    });
    users.set(p.email, u.id);
  }
  // A pending invitation (not yet activated) for the user administration screens
  await prisma.user.create({ data: { email: "new.starter@apex-demo.test", name: "Jordan Ellis", status: "INVITED", isDemo: true, roles: { create: [{ roleId: roles.get("EMPLOYEE")! }] }, profile: { create: { jobRoleId: jobRoles.get("FO"), departmentId: depts.get("OPS"), businessUnitId: bus.get("DWN"), location: "Coastal Refinery Complex", employeeNumber: "D-20999" } }, accessGrants: { create: { jobRoleId: jobRoles.get("FO")!, reason: "Starting job title" } } } });
  const U = (email: string) => users.get(email)!;
  for (const p of PEOPLE) if (p.manager) await prisma.managerRelationship.create({ data: { managerId: U(p.manager), employeeId: U(p.email), startDate: daysAgo(400) } });
  // Department heads without explicit managers report to the L&D view only (no relationship).

  const admin = U("helen.mercer@apex-demo.test");
  const omar = U("omar.haddad@apex-demo.test");

  await prisma.certificateTemplate.create({
    data: { name: "Standard completion certificate", heading: "Certificate of Completion", bodyText: "has successfully completed all requirements of", signatoryName: "Dr Helen Mercer", signatoryTitle: "Head of Learning & Development", isDefault: true },
  });

  // ── Generated reference documents (private storage)
  const files = {
    "bowtie-reference": await storeFile(await makePdf("Bow-tie barrier quick reference", ["Top event: loss of containment of hydrocarbons.", "Threats: corrosion, overpressure, overfill, external impact, maintenance error.", "Prevention barriers: inspection, relief systems, high-level trips, permit to work.", "Mitigation barriers: gas detection, ESD, deluge, emergency response.", "Escalation factors: bypass, deferred inspection, inadequate competence.", "", "Use on shift: which barriers are impaired today? What compensating measures apply?"]), "Bow-tie barrier quick reference.pdf", admin, "COURSE_MATERIAL"),
    "dmaic-worksheet": await storeFile(await makePdf("DMAIC project worksheet", ["Define: problem statement, business impact, scope, goal, team.", "Measure: data collection plan, MSA result, baseline capability.", "Analyse: candidate causes, verification method, verified root causes.", "Improve: solutions, pilot plan, results versus baseline.", "Control: control plan, owner, response plan, benefit validation."]), "DMAIC project worksheet.pdf", admin, "COURSE_MATERIAL"),
  };

  // ── Courses
  const courses = new Map<string, { id: string; lessons: { id: string; minutes: number; type: string; required: boolean; title: string }[]; assessmentId: string | null; questions: { id: string; points: number }[]; cpd: number | null; validity: number | null; title: string; competencies: [string, number][] }>();
  for (const [ci, c] of ALL_COURSES.entries()) {
    const course = await prisma.course.create({
      data: {
        code: c.code,
        slug: c.code.toLowerCase() + "-" + c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        title: c.title,
        categoryId: cats.get(c.category)!,
        synopsis: c.synopsis,
        overview: c.overview,
        businessRelevance: c.businessRelevance,
        intendedAudience: c.audience,
        prerequisitesText: c.prerequisitesText ?? null,
        objectives: c.objectives,
        outcomes: c.outcomes,
        keywords: c.keywords,
        difficulty: c.difficulty,
        deliveryMode: c.delivery,
        provider: c.provider ?? "Internal — Learning & Development",
        estimatedHours: c.hours,
        cpdEligible: !!c.cpd,
        cpdValue: c.cpd?.value ?? null,
        cpdAccreditationNote: c.cpd?.note ?? null,
        isMandatory: !!c.mandatory,
        enrolmentRule: c.enrolmentRule ?? "OPEN",
        status: c.status ?? "PUBLISHED",
        requireAllLessons: c.requireAllLessons ?? true,
        requireAssessmentPass: c.requireAssessmentPass ?? false,
        requireAssignmentApproval: c.requireAssignmentApproval ?? false,
        requireAcknowledgement: !!c.acknowledgement,
        acknowledgementText: c.acknowledgement ?? null,
        certificateEnabled: true,
        certificateValidityMonths: c.certValidityMonths ?? null,
        recertificationNote: c.recertificationNote ?? null,
        publishedAt: c.status && c.status !== "PUBLISHED" ? null : daysAgo(400 - ci * 12),
        createdById: admin,
        departments: { create: c.departments.map((d) => ({ departmentId: depts.get(d)! })) },
        competencies: { create: c.competencies.map(([code, lvl]) => ({ competencyId: comps.get(code)!, targetLevel: lvl })) },
        instructors: { create: c.instructors.map((e, i) => ({ userId: U(e), isLead: i === 0 })) },
      },
    });
    let assessmentId: string | null = null;
    let questions: { id: string; points: number }[] = [];
    if (c.assessment) {
      const a = await prisma.assessment.create({ data: { courseId: course.id, title: c.assessment.title, passingScore: c.assessment.passing, maxAttempts: c.assessment.attempts, isFinal: true, description: "Final assessment. Your best passing attempt is recorded." } });
      assessmentId = a.id;
      for (const [qi, q] of c.assessment.questions.entries()) {
        const opts = q.options?.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
        const row = await prisma.assessmentQuestion.create({
          data: {
            assessmentId: a.id,
            sortOrder: qi,
            type: q.type,
            prompt: q.prompt,
            points: q.points ?? 1,
            options: opts ?? Prisma.JsonNull,
            correctOptionId: q.type === "MULTIPLE_CHOICE" ? String.fromCharCode(97 + (q.correct as number)) : null,
            correctBoolean: q.type === "TRUE_FALSE" ? (q.correct as boolean) : null,
            guidance: q.guidance ?? null,
          },
        });
        questions.push({ id: row.id, points: row.points });
      }
    }
    const lessons: { id: string; minutes: number; type: string; required: boolean; title: string }[] = [];
    for (const [mi, m] of c.modules.entries()) {
      const mod = await prisma.courseModule.create({ data: { courseId: course.id, title: m.title, description: m.description, sortOrder: mi } });
      for (const [li, l] of m.lessons.entries()) {
        const lesson = await prisma.lesson.create({
          data: {
            moduleId: mod.id,
            title: l.title,
            type: l.type,
            sortOrder: li,
            body: l.body ?? null,
            externalUrl: l.url ?? null,
            durationMinutes: l.minutes,
            isRequired: l.required ?? true,
            assessmentId: l.type === "ASSESSMENT" ? assessmentId : null,
          },
        });
        if (l.resource) await prisma.lessonResource.create({ data: { lessonId: lesson.id, fileId: files[l.resource as keyof typeof files].id, label: files[l.resource as keyof typeof files].originalName.replace(/\.pdf$/, "") } });
        lessons.push({ id: lesson.id, minutes: l.minutes, type: l.type, required: l.required ?? true, title: l.title });
      }
    }
    courses.set(c.code, { id: course.id, lessons, assessmentId, questions, cpd: c.cpd?.value ?? null, validity: c.certValidityMonths ?? null, title: c.title, competencies: c.competencies });
  }
  for (const c of ALL_COURSES) for (const pre of c.prerequisites ?? []) await prisma.coursePrerequisite.create({ data: { courseId: courses.get(c.code)!.id, prerequisiteId: courses.get(pre)!.id } });

  // ── Job-title content access
  for (const [code, roleCodes] of Object.entries(COURSE_AUDIENCES)) {
    await prisma.courseAudience.createMany({ data: roleCodes.map((r) => ({ courseId: courses.get(code)!.id, jobRoleId: jobRoles.get(r)! })) });
  }
  const accessAdmin = U("helen.mercer@apex-demo.test");
  for (const p of PEOPLE) {
    const levels = [p.role, ...(EARLIER_LEVELS[p.role] ?? [])];
    await prisma.contentAccessGrant.createMany({ data: levels.map((r, i) => ({ userId: U(p.email), jobRoleId: jobRoles.get(r)!, grantedById: accessAdmin, reason: i === 0 ? "Current job title" : "Earlier level in career track", grantedAt: daysAgo(p.hiredMonthsAgo * 30 + 1) })) });
  }
  // Promoted by HR; the next level's content is waiting on an administrator's decision.
  await prisma.userProfile.update({ where: { userId: U(PENDING_PROMOTION.email) }, data: { jobRoleId: jobRoles.get(PENDING_PROMOTION.to) } });
  await prisma.auditLog.create({ data: { actorId: accessAdmin, action: "user.job_title.change", entityType: "user", entityId: U(PENDING_PROMOTION.email), metadata: { from: jobRoles.get(PENDING_PROMOTION.from)!, to: jobRoles.get(PENDING_PROMOTION.to)! }, createdAt: daysAgo(2) } });

  // ── Learning paths
  const paths = new Map<string, string>();
  for (const lp of LEARNING_PATHS) {
    const hours = lp.items.reduce((s, [code]) => s + (ALL_COURSES.find((c) => c.code === code)?.hours ?? 0), 0);
    const row = await prisma.learningPath.create({
      data: {
        code: lp.code,
        slug: lp.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        title: lp.title,
        summary: lp.summary,
        targetAudience: lp.audience,
        entryRequirements: lp.entry ?? null,
        completionCriteria: "Complete all required courses, including their assessments. Optional enrichment courses are recommended but do not affect completion.",
        expectedHours: hours,
        estimatedDurationWeeks: lp.weeks,
        cpdEligible: lp.cpd,
        targetJobRoleId: lp.target ? jobRoles.get(lp.target) : null,
        status: lp.published ? "PUBLISHED" : "DRAFT",
        competencies: { create: lp.competencies.map((c) => ({ competencyId: comps.get(c)! })) },
      },
    });
    paths.set(lp.code, row.id);
    const itemIds = new Map<string, string>();
    for (const [i, [code, required]] of lp.items.entries()) {
      const it = await prisma.learningPathItem.create({ data: { pathId: row.id, courseId: courses.get(code)!.id, sortOrder: i, isRequired: required } });
      itemIds.set(code, it.id);
    }
    for (const [code, , pre] of lp.items) if (pre) await prisma.learningPathItem.update({ where: { id: itemIds.get(code)! }, data: { prerequisiteItemId: itemIds.get(pre)! } });
  }

  // ── Learning record helpers
  const event = (userId: string, type: Prisma.LearningActivityEventCreateInput["type"], summary: string, at: Date, ref?: [string, string]) =>
    prisma.learningActivityEvent.create({ data: { userId, type, summary, occurredAt: at, refType: ref?.[0], refId: ref?.[1] } });

  const policyOf = (email: string) => {
    const p = PEOPLE.find((x) => x.email === email)?.cpdPolicy;
    return p ? policies[p as keyof typeof policies] : null;
  };

  async function complete(email: string, code: string, ago: number, percent = between(78, 98)) {
    const userId = U(email);
    const c = courses.get(code)!;
    const completedAt = daysAgo(ago);
    const startedAt = daysAgo(ago + between(5, 30));
    const totalSec = c.lessons.reduce((s, l) => s + l.minutes * 60 * (0.8 + rand() * 0.5), 0);
    const e = await prisma.enrollment.create({ data: { userId, courseId: c.id, status: "COMPLETED", enrolledAt: startedAt, startedAt, lastAccessedAt: completedAt, completedAt, acknowledgedAt: completedAt, timeSpentSeconds: Math.round(totalSec) } });
    await event(userId, "ENROLLED", `Enrolled in ${c.title}`, startedAt, ["course", c.id]);
    for (const [i, l] of c.lessons.entries()) {
      const at = new Date(startedAt.getTime() + ((completedAt.getTime() - startedAt.getTime()) * (i + 1)) / c.lessons.length);
      await prisma.lessonProgress.create({ data: { enrollmentId: e.id, lessonId: l.id, startedAt: at, completedAt: at, lastViewedAt: at, timeSpentSeconds: Math.round(l.minutes * 60 * (0.8 + rand() * 0.5)) } });
    }
    let finalPercent: number | null = null;
    if (c.assessmentId) {
      const max = c.questions.reduce((s, q) => s + q.points, 0);
      const score = Math.round((percent / 100) * max);
      finalPercent = Math.round((score / max) * 100);
      await prisma.assessmentAttempt.create({ data: { assessmentId: c.assessmentId, enrollmentId: e.id, userId, attemptNumber: 1, status: "GRADED", startedAt: completedAt, submittedAt: completedAt, gradedAt: completedAt, score, maxScore: max, percent: finalPercent, passed: true } });
      await event(userId, "ASSESSMENT_PASSED", `Passed ${c.title} assessment — ${finalPercent}%`, completedAt, ["course", c.id]);
    }
    const comp = await prisma.courseCompletion.create({ data: { enrollmentId: e.id, userId, courseId: c.id, completedAt, finalPercent, ruleSnapshot: [{ rule: "requireAllLessons", met: true, label: "All required lessons completed" }, ...(c.assessmentId ? [{ rule: "requireAssessmentPass", met: true, label: "Final assessment passed" }] : [])] } });
    await event(userId, "COURSE_COMPLETED", `Completed ${c.title}`, completedAt, ["course", c.id]);
    const cert = await prisma.certificate.create({ data: { serial: `APX-${completedAt.getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`, userId, courseId: c.id, completionId: comp.id, issuedAt: completedAt, expiresAt: c.validity ? addMonths(completedAt, c.validity) : null } });
    await event(userId, "CERTIFICATE_ISSUED", `Certificate issued: ${c.title}`, completedAt, ["certificate", cert.id]);
    await prisma.learningAssignment.updateMany({ where: { userId, courseId: c.id, status: "ASSIGNED", createdAt: { lte: completedAt } }, data: { status: "COMPLETED", completedAt } });
    if (c.cpd) {
      const pol = policyOf(email);
      const val = pol?.unit === "POINTS" ? Math.min(c.cpd, Number(pol.maxPerActivity ?? 99)) : Math.min(c.cpd, Number(pol?.maxPerActivity ?? 99));
      const act = await prisma.cpdActivity.create({ data: { userId, title: c.title, type: "INTERNAL_COURSE", provider: "Internal — Learning & Development", activityDate: completedAt, durationHours: c.cpd, courseCompletionId: comp.id } });
      const auto = pol?.autoApproveVerifiedInternal ?? false;
      const decidedAt = new Date(completedAt.getTime() + (auto ? 0 : between(1, 6) * DAY));
      const claim = await prisma.cpdClaim.create({ data: { activityId: act.id, userId, periodId: periodFor(completedAt), unit: pol?.unit ?? "HOURS", claimedValue: val, approvedValue: val, status: "APPROVED", submittedAt: completedAt, decidedAt, evidence: { create: { description: "Platform-verified course completion record", reference: comp.id } } } });
      await prisma.cpdApproval.createMany({ data: [
        { claimId: claim.id, actorId: userId, fromStatus: "DRAFT", toStatus: "SUBMITTED", comment: "Raised automatically from verified course completion", createdAt: completedAt },
        ...(auto ? [] : [{ claimId: claim.id, actorId: admin, fromStatus: "SUBMITTED" as const, toStatus: "UNDER_REVIEW" as const, createdAt: decidedAt }]),
        { claimId: claim.id, actorId: auto ? userId : admin, fromStatus: auto ? ("SUBMITTED" as const) : ("UNDER_REVIEW" as const), toStatus: "APPROVED", value: val, comment: auto ? `Auto-approved under policy "${pol!.name}"` : "Verified internal course completion", createdAt: decidedAt },
      ] });
      await event(userId, "CPD_APPROVED", `CPD claim approved (${val} ${(pol?.unit ?? "HOURS").toLowerCase()}): ${c.title}`, decidedAt, ["cpd_claim", claim.id]);
    }
    for (const [code2, lvl] of c.competencies) {
      const existing = await prisma.competencyAssessment.findFirst({ where: { userId, competencyId: comps.get(code2)!, status: "CURRENT" } });
      if (existing) continue;
      await prisma.competencyAssessment.create({ data: { userId, competencyId: comps.get(code2)!, level: lvl, method: "COURSE_COMPLETION", basis: "KNOWLEDGE", assessedAt: completedAt, notes: `Knowledge acquired through ${code}. Workplace demonstration is still required.`, evidence: { create: { kind: "COURSE_COMPLETION", description: `Course completion: ${c.title}`, reference: comp.id } } } });
    }
    return { enrollment: e, completion: comp, cert };
  }

  async function inProgress(email: string, code: string, fraction: number, lastAgo: number, dueIn?: number) {
    const userId = U(email);
    const c = courses.get(code)!;
    const startedAt = daysAgo(lastAgo + between(3, 20));
    const req = c.lessons.filter((l) => l.type !== "ASSESSMENT" && l.type !== "ASSIGNMENT");
    const n = Math.max(1, Math.floor(req.length * fraction));
    const latest = await prisma.enrollment.findFirst({ where: { userId, courseId: c.id }, orderBy: { cycle: "desc" } });
    const e = latest && latest.status !== "COMPLETED"
      ? await prisma.enrollment.update({ where: { id: latest.id }, data: { startedAt, lastAccessedAt: daysAgo(lastAgo) } })
      : await prisma.enrollment.create({ data: { userId, courseId: c.id, cycle: (latest?.cycle ?? 0) + 1, status: "ACTIVE", enrolledAt: startedAt, startedAt, lastAccessedAt: daysAgo(lastAgo), dueDate: dueIn != null ? daysAhead(dueIn) : null, source: dueIn != null ? "ASSIGNMENT" : "SELF", timeSpentSeconds: 0 } });
    let total = 0;
    for (const [i, l] of req.slice(0, n).entries()) {
      const at = new Date(startedAt.getTime() + ((daysAgo(lastAgo).getTime() - startedAt.getTime()) * (i + 1)) / n);
      const sec = Math.round(l.minutes * 60 * (0.8 + rand() * 0.4));
      total += sec;
      await prisma.lessonProgress.create({ data: { enrollmentId: e.id, lessonId: l.id, startedAt: at, completedAt: at, lastViewedAt: at, timeSpentSeconds: sec } });
      await event(userId, "LESSON_COMPLETED", `Completed lesson: ${l.title}`, at, ["lesson", l.id]);
    }
    await prisma.enrollment.update({ where: { id: e.id }, data: { timeSpentSeconds: total } });
    await event(userId, "ENROLLED", `Enrolled in ${c.title}`, startedAt, ["course", c.id]);
    return e;
  }

  async function assign(email: string, code: string, opts: { mandatory?: boolean; dueIn?: number; by?: string; kind?: "REQUIRED" | "RECOMMENDED"; createdAgo?: number; reason?: string }) {
    return prisma.learningAssignment.create({
      data: {
        userId: U(email),
        courseId: courses.get(code)!.id,
        assignedById: opts.by ?? admin,
        kind: opts.kind ?? "REQUIRED",
        isMandatory: !!opts.mandatory,
        dueDate: opts.dueIn != null ? daysAhead(opts.dueIn) : null,
        reason: opts.reason ?? (opts.mandatory ? "Mandatory for operational roles under the site training matrix." : null),
        createdAt: daysAgo(opts.createdAgo ?? 60),
      },
    });
  }

  async function assess(email: string, code: string, level: number, ago: number, method: "WORKPLACE_OBSERVATION" | "SUPERVISOR_EVALUATION" | "PRACTICAL_DEMONSTRATION" | "FORMAL_ASSESSMENT" = "WORKPLACE_OBSERVATION", assessor = omar) {
    const userId = U(email);
    const competencyId = comps.get(code)!;
    const comp = DOMAINS.flatMap((d) => d.competencies).find((c) => c.code === code)!;
    await prisma.competencyAssessment.updateMany({ where: { userId, competencyId, status: "CURRENT" }, data: { status: "SUPERSEDED" } });
    const at = daysAgo(ago);
    const a = await prisma.competencyAssessment.create({
      data: {
        userId,
        competencyId,
        level,
        method,
        basis: "DEMONSTRATED",
        assessedAt: at,
        assessorId: assessor,
        reassessmentDue: comp.reassess ? addMonths(at, comp.reassess) : null,
        notes: "Assessed against the framework criteria during normal operations.",
        evidence: { create: { kind: method, description: `${method === "WORKPLACE_OBSERVATION" ? "Observed" : "Evaluated"} performing ${comp.name.toLowerCase()} on shift.`, reference: `OBS-${between(1000, 9999)}` } },
      },
    });
    await prisma.competencyAssessmentHistory.create({ data: { assessmentId: a.id, action: "created", toStatus: "CURRENT", actorId: assessor, createdAt: at } });
    await event(userId, "COMPETENCY_ASSESSED", `${comp.name} assessed at level ${level} — ${method.replace(/_/g, " ").toLowerCase()}`, at, ["competency_assessment", a.id]);
  }

  async function manualClaim(email: string, title: string, type: "EXTERNAL_TRAINING" | "CONFERENCE" | "TECHNICAL_PRESENTATION" | "PUBLICATION" | "MENTORING" | "TECHNICAL_SEMINAR", hours: number, ago: number, status: CpdClaimStatus, opts: { provider?: string; reason?: string; recognition?: "COMPANY_RECORDED" | "PROFESSIONAL_BODY"; value?: number; comp?: string; file?: boolean } = {}) {
    const userId = U(email);
    const pol = policyOf(email);
    const at = daysAgo(ago);
    const value = opts.value ?? Math.min(hours, Number(pol?.maxPerActivity ?? 99));
    const act = await prisma.cpdActivity.create({ data: { userId, title, type, provider: opts.provider ?? null, activityDate: at, durationHours: hours, description: `${title}. Participation recorded by the employee.`, learningOutcomes: "Updated understanding of current practice and its application to site operations.", competencyId: opts.comp ? comps.get(opts.comp) : null } });
    const submittedAt = status === "DRAFT" ? null : new Date(at.getTime() + 2 * DAY);
    const decidedAt = status === "APPROVED" || status === "REJECTED" ? new Date(at.getTime() + 8 * DAY) : null;
    const evidenceFile = opts.file ? await storeFile(await makePdf("Attendance certificate (fictional)", [title, `Provider: ${opts.provider ?? "External provider"}`, `Duration: ${hours} hours`, "This is a generated demonstration document."]), `${title.slice(0, 40)} certificate.pdf`, userId, "CPD_EVIDENCE") : null;
    const claim = await prisma.cpdClaim.create({
      data: {
        activityId: act.id, userId, periodId: periodFor(at), unit: pol?.unit ?? "HOURS", claimedValue: value, approvedValue: status === "APPROVED" ? value : null, status, recognition: opts.recognition ?? "COMPANY_RECORDED", submittedAt, decidedAt, rejectionReason: status === "REJECTED" ? opts.reason ?? null : null,
        evidence: { create: { description: opts.file ? "Attendance certificate" : "Agenda and attendance confirmation", reference: `EXT-${between(10000, 99999)}`, fileId: evidenceFile?.id ?? null } },
      },
    });
    const hist: Prisma.CpdApprovalCreateManyInput[] = [];
    if (submittedAt) hist.push({ claimId: claim.id, actorId: userId, fromStatus: "DRAFT", toStatus: "SUBMITTED", createdAt: submittedAt });
    if (status === "UNDER_REVIEW" || decidedAt) hist.push({ claimId: claim.id, actorId: admin, fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", createdAt: new Date(at.getTime() + 4 * DAY) });
    if (decidedAt) hist.push({ claimId: claim.id, actorId: admin, fromStatus: "UNDER_REVIEW", toStatus: status, value: status === "APPROVED" ? value : null, comment: status === "REJECTED" ? opts.reason : "Evidence verified", createdAt: decidedAt });
    if (hist.length) await prisma.cpdApproval.createMany({ data: hist });
    if (submittedAt) await event(userId, "CPD_SUBMITTED", `Submitted CPD claim: ${title}`, submittedAt, ["cpd_claim", claim.id]);
    if (decidedAt) await event(userId, status === "APPROVED" ? "CPD_APPROVED" : "CPD_REJECTED", `CPD claim ${status === "APPROVED" ? "approved" : "rejected"}: ${title}`, decidedAt, ["cpd_claim", claim.id]);
    return claim;
  }

  // ── Mandatory training matrix: operational staff
  const operational = PEOPLE.filter((p) => ["OPS", "UTL", "MNT", "UPO", "HSE"].includes(p.dept) && p.roles.length === 1);

  // ── Persona: James Okafor — several completed courses, strong record
  const james = "james.okafor@apex-demo.test";
  await complete(james, "PSM-101", 300);
  await complete(james, "DAT-210", 520);
  await complete(james, "OPX-210", 250);
  await complete(james, "LSS-300", 190, 91);
  await complete(james, "QRA-320", 120, 88);
  await complete(james, "UTL-240", 70);
  await complete(james, "ETH-100", 40);
  await inProgress(james, "LDR-300", 0.34, 6);
  await inProgress(james, "DEC-330", 0.5, 12);
  for (const [code, lvl, ago] of [["TK-01", 4, 200], ["TK-02", 3, 200], ["PS-03", 3, 150], ["OE-01", 3, 120], ["OE-03", 3, 90], ["DA-01", 4, 90], ["RM-01", 3, 60]] as const) await assess(james, code, lvl, ago, "SUPERVISOR_EVALUATION");
  await manualClaim(james, "Regional refining technology conference", "CONFERENCE", 12, 150, "APPROVED", { provider: "Regional refining association", recognition: "PROFESSIONAL_BODY", file: true });
  await manualClaim(james, "Presented: Hydrotreater catalyst life analysis", "TECHNICAL_PRESENTATION", 4, 45, "APPROVED", { provider: "Internal technical forum", recognition: "PROFESSIONAL_BODY" });
  await manualClaim(james, "Mentoring two graduate engineers", "MENTORING", 8, 20, "SUBMITTED", { recognition: "PROFESSIONAL_BODY", comp: "LD-02" });

  // ── Persona: Daniel Reyes — overdue mandatory training
  const daniel = "daniel.reyes@apex-demo.test";
  await assign(daniel, "HSE-110", { mandatory: true, createdAgo: 800, dueIn: -770 });
  await complete(daniel, "HSE-110", 790); // certificate expired (24-month validity)
  await assign(daniel, "HSE-110", { mandatory: true, createdAgo: 70, dueIn: -18, reason: "Recertification — previous certificate expired." });
  await complete(daniel, "PSM-101", 600);
  await assign(daniel, "PSM-120", { mandatory: true, createdAgo: 75, dueIn: -9 });
  await inProgress(daniel, "PSM-120", 0.34, 40, -9);
  await inProgress(daniel, "HSE-110", 0, 55, -18).catch(() => undefined);
  await complete(daniel, "INS-220", 210);
  for (const [code, lvl, ago] of [["PO-01", 3, 400], ["PO-02", 3, 400], ["PO-03", 2, 380], ["PS-01", 3, 500], ["PS-02", 2, 500], ["PS-04", 2, 760], ["HS-01", 2, 790], ["TK-01", 2, 300]] as const) await assess(daniel, code, lvl, ago);
  await manualClaim(daniel, "Vendor training: dry gas seal systems", "EXTERNAL_TRAINING", 6, 260, "APPROVED", { provider: "Compressor vendor (fictional)" });

  // ── Persona: Aisha Rahman — progressing through Field Operator Development
  const aisha = "aisha.rahman@apex-demo.test";
  await prisma.learningAssignment.create({ data: { userId: U(aisha), pathId: paths.get("LP-FOD")!, assignedById: omar, kind: "REQUIRED", dueDate: daysAhead(75), reason: "Development path for field operator sign-off.", createdAt: daysAgo(200) } });
  await prisma.learningPathEnrollment.create({ data: { userId: U(aisha), pathId: paths.get("LP-FOD")!, startedAt: daysAgo(200) } });
  await event(U(aisha), "PATH_STARTED", "Started learning path: Field Operator Development", daysAgo(200));
  await assign(aisha, "HSE-110", { mandatory: true, createdAgo: 200, dueIn: -150 });
  await complete(aisha, "HSE-110", 180, 100);
  await assign(aisha, "PSM-120", { mandatory: true, createdAgo: 200, dueIn: -120 });
  await complete(aisha, "PSM-120", 140, 100);
  await assign(aisha, "PSM-101", { mandatory: true, createdAgo: 200, dueIn: -20 });
  await complete(aisha, "PSM-101", 60, 88);
  const aishaOps = await inProgress(aisha, "OPS-150", 1, 3);
  const opsAssignmentLesson = courses.get("OPS-150")!.lessons.find((l) => l.type === "ASSIGNMENT")!;
  await prisma.assignmentSubmission.create({ data: { lessonId: opsAssignmentLesson.id, enrollmentId: aishaOps.id, userId: U(aisha), submittedAt: daysAgo(3), body: "Completed three supervised field rounds on the crude distillation unit (CDU) with T. Nowak on night shift. Round 1: checked crude charge pumps P-101A/B — seal on P-101B weeping, notification raised. Round 2: fired heater H-101 burner inspection, flame pattern normal, excess O2 3.1%. Round 3: overhead accumulator level glass cross-checked against DCS; handover notes given to day shift covering P-101B seal and permit for exchanger E-104 cleaning." } });
  for (const [code, lvl, ago] of [["PO-01", 2, 90], ["PO-02", 2, 90], ["HS-01", 2, 170], ["PS-04", 2, 130]] as const) await assess(aisha, code, lvl, ago);

  // ── Persona: Lina Saleh — new employee (three weeks)
  const lina = "lina.saleh@apex-demo.test";
  await prisma.learningAssignment.create({ data: { userId: U(lina), pathId: paths.get("LP-FOD")!, assignedById: omar, kind: "REQUIRED", dueDate: daysAhead(160), reason: "New operator induction programme.", createdAt: daysAgo(18) } });
  await prisma.learningPathEnrollment.create({ data: { userId: U(lina), pathId: paths.get("LP-FOD")!, startedAt: daysAgo(18) } });
  await assign(lina, "HSE-110", { mandatory: true, createdAgo: 18, dueIn: 12 });
  await assign(lina, "PSM-120", { mandatory: true, createdAgo: 18, dueIn: 40 });
  await assign(lina, "PSM-101", { mandatory: true, createdAgo: 18, dueIn: 70 });
  await inProgress(lina, "HSE-110", 0.34, 1, 12);

  // ── Persona: Priya Natarajan — pending CPD claims
  const priya = "priya.natarajan@apex-demo.test";
  await complete(priya, "REL-200", 400);
  await complete(priya, "REL-310", 260);
  await complete(priya, "AIM-260", 150);
  await complete(priya, "PSM-101", 330);
  await inProgress(priya, "LSS-300", 0.4, 9);
  await manualClaim(priya, "Vibration Analyst Category II course", "EXTERNAL_TRAINING", 32, 35, "SUBMITTED", { provider: "Condition monitoring institute (fictional)", recognition: "PROFESSIONAL_BODY", value: 20, file: true, comp: "ER-01" });
  await manualClaim(priya, "Reliability & maintenance conference", "CONFERENCE", 14, 22, "UNDER_REVIEW", { provider: "Regional maintenance society (fictional)", recognition: "PROFESSIONAL_BODY" });
  await manualClaim(priya, "Paper: Seal failure analysis on hydrocarbon pumps", "PUBLICATION", 10, 12, "SUBMITTED", { recognition: "PROFESSIONAL_BODY", comp: "ER-02" });
  await manualClaim(priya, "Lunch-and-learn on lubrication", "TECHNICAL_SEMINAR", 1, 80, "REJECTED", { reason: "Activity under one hour of structured learning does not meet the minimum duration in the Engineering Professional Registration policy. Combine with related activities in a single claim." });
  await manualClaim(priya, "Root cause analysis facilitator workshop", "EXTERNAL_TRAINING", 8, 140, "APPROVED", { provider: "Training provider (fictional)" });
  await manualClaim(priya, "Mentoring maintenance apprentices", "MENTORING", 6, 4, "DRAFT", {});
  for (const [code, lvl, ago] of [["ER-01", 3, 200], ["ER-02", 3, 220], ["ER-03", 2, 150], ["DA-01", 2, 300]] as const) await assess(priya, code, lvl, ago, "SUPERVISOR_EVALUATION");

  // ── Omar & Tomasz
  await complete("omar.haddad@apex-demo.test", "PSM-101", 500);
  await complete("omar.haddad@apex-demo.test", "LDR-300", 420);
  await complete("omar.haddad@apex-demo.test", "OPX-210", 380);
  await complete("omar.haddad@apex-demo.test", "QRA-320", 100);
  await manualClaim("omar.haddad@apex-demo.test", "Operations leadership summit", "CONFERENCE", 10, 95, "APPROVED", { provider: "Industry association (fictional)" });
  await complete("tomasz.nowak@apex-demo.test", "PSM-101", 340);
  await complete("tomasz.nowak@apex-demo.test", "PSM-120", 300);
  await complete("tomasz.nowak@apex-demo.test", "LDR-300", 150);
  await assess("tomasz.nowak@apex-demo.test", "LD-01", 3, 120);
  await assess("tomasz.nowak@apex-demo.test", "PO-03", 3, 120);

  // ── Remaining population (deterministic variation)
  const pool = ["PSM-101", "HSE-110", "PSM-120", "REL-200", "INS-220", "LSS-110", "DAT-210", "ETH-100", "UTL-240", "AIM-260", "DIG-150", "REG-210", "UPS-150", "COM-230", "PMG-200"];
  const others = PEOPLE.filter((p) => ![james, daniel, aisha, lina, priya, "omar.haddad@apex-demo.test", "tomasz.nowak@apex-demo.test", "helen.mercer@apex-demo.test", "catherine.lowe@apex-demo.test"].includes(p.email));
  for (const p of others) {
    const deptCodes = new Set([p.dept]);
    const eligible = pool.filter((code) => ALL_COURSES.find((c) => c.code === code)!.departments.some((d) => deptCodes.has(d)));
    const n = between(1, Math.min(4, eligible.length));
    const chosen = [...eligible].sort(() => rand() - 0.5).slice(0, n);
    for (const code of chosen) await complete(p.email, code, between(15, 500));
    const rest = eligible.filter((c) => !chosen.includes(c));
    if (rest.length && rand() > 0.3) await inProgress(p.email, rest[0], 0.3 + rand() * 0.5, between(1, 60));
    for (const req of JOB_ROLES.find((r) => r.code === p.role)!.reqs) {
      if (rand() > 0.35) await assess(p.email, req[0], Math.max(1, Math.min(5, req[1] + (rand() > 0.6 ? -1 : 0))), between(30, 700));
    }
    if (rand() > 0.5) await manualClaim(p.email, "External technical short course", "EXTERNAL_TRAINING", between(4, 16), between(20, 250), rand() > 0.25 ? "APPROVED" : "SUBMITTED", { provider: "External provider (fictional)" });
  }
  // Mandatory matrix for operational staff not set up above
  for (const p of operational) {
    if ([daniel, aisha, lina].includes(p.email)) continue;
    for (const code of ["HSE-110", "PSM-120"]) {
      const done = await prisma.courseCompletion.findFirst({ where: { userId: U(p.email), courseId: courses.get(code)!.id } });
      await prisma.learningAssignment.create({ data: { userId: U(p.email), courseId: courses.get(code)!.id, assignedById: admin, kind: "REQUIRED", isMandatory: true, dueDate: done ? new Date(done.completedAt.getTime() + 10 * DAY) : daysAhead(between(-30, 60)), reason: "Mandatory for operational roles under the site training matrix.", status: done ? "COMPLETED" : "ASSIGNED", completedAt: done?.completedAt ?? null, createdAt: done ? new Date(done.completedAt.getTime() - 30 * DAY) : daysAgo(45) } });
      if (!done && !(await prisma.enrollment.findFirst({ where: { userId: U(p.email), courseId: courses.get(code)!.id } }))) await prisma.enrollment.create({ data: { userId: U(p.email), courseId: courses.get(code)!.id, status: "ACTIVE", source: "ASSIGNMENT", enrolledAt: daysAgo(45) } });
    }
  }

  // ── Pending short-answer grading (OPX-210, instructor Omar)
  const yusuf = "yusuf.kareem@apex-demo.test";
  const opx = courses.get("OPX-210")!;
  if (!(await prisma.courseCompletion.findFirst({ where: { userId: U(yusuf), courseId: opx.id } }))) {
    await complete(yusuf, "PSM-101", 420).catch(() => undefined);
    const e = await inProgress(yusuf, "OPX-210", 1, 2);
    const qs = await prisma.assessmentQuestion.findMany({ where: { assessmentId: opx.assessmentId! }, orderBy: { sortOrder: "asc" } });
    const objective = qs.filter((q) => q.type !== "SHORT_ANSWER");
    const objScore = objective.reduce((s, q) => s + q.points, 0);
    await prisma.assessmentAttempt.create({
      data: {
        assessmentId: opx.assessmentId!, enrollmentId: e.id, userId: U(yusuf), attemptNumber: 1, status: "PENDING_REVIEW", submittedAt: daysAgo(2), maxScore: qs.reduce((s, q) => s + q.points, 0),
        responses: { create: qs.map((q) => q.type === "SHORT_ANSWER"
          ? { questionId: q.id, textAnswer: "After the RCA on repeated P-205 seal failures we changed the flush plan. To verify, I would track mean time between failures for 6 months against the 18-month baseline and confirm seal pot pressure stays within the new operating window on every round." }
          : { questionId: q.id, selectedOptionId: q.correctOptionId, booleanAnswer: q.correctBoolean, isCorrect: true, pointsAwarded: q.points }) },
      },
    });
    void objScore;
    await event(U(yusuf), "ASSESSMENT_SUBMITTED", "Submitted Operational excellence assessment (attempt 1) for review", daysAgo(2));
  }

  // ── Pending enrolment approval (LSS-300 requires approval)
  await prisma.enrollment.create({ data: { userId: U("sofia.marin@apex-demo.test"), courseId: courses.get("LSS-300")!.id, status: "PENDING_APPROVAL", enrolledAt: daysAgo(1) } }).catch(() => undefined);

  // ── Webinars
  const webinarCat = (slug: string) => cats.get(slug)!;
  const mkWebinar = (code: string, title: string, data: Partial<Prisma.WebinarUncheckedCreateInput> & { startsAt: Date; durationMinutes: number; speakerName: string; synopsis: string }) =>
    prisma.webinar.create({
      data: {
        code,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        title,
        overview: data.synopsis + " The session includes a moderated question-and-answer segment.",
        objectives: data.objectives ?? [],
        timeZone: "Asia/Baghdad",
        meetingProvider: "MICROSOFT_TEAMS",
        meetingUrl: "https://teams.example.invalid/meet/demo-" + code.toLowerCase(),
        registrationRequirements: "Open to all employees. Register at least 24 hours in advance so joining details can be confirmed.",
        ...data,
      } as Prisma.WebinarUncheckedCreateInput,
    });
  const wReliability = await mkWebinar("WEB-031", "Reliability-Centred Maintenance: Lessons from the Field", { startsAt: daysAhead(9), durationMinutes: 75, speakerName: "Dr Ingrid Solberg", speakerTitle: "Principal Reliability Consultant (fictional)", speakerBio: "Twenty years leading RCM programmes in refining and petrochemicals; former reliability manager for a large hydrocracker complex.", synopsis: "Case studies of RCM implementation on critical rotating equipment, including how failure data reshaped maintenance intervals.", objectives: ["Explain why RCM programmes stall after the analysis phase.", "Use failure data to challenge legacy maintenance intervals.", "Identify hidden failures in protective devices."], categoryId: webinarCat("reliability-and-maintenance"), cpdEligible: true, cpdValue: 1.25, minAttendanceMinutes: 60, capacity: 120, agenda: [{ time: "00:00", item: "Introduction" }, { time: "00:10", item: "Case study: compressor train" }, { time: "00:40", item: "Hidden failures and failure-finding" }, { time: "01:00", item: "Questions" }] });
  const wSafety = await mkWebinar("WEB-032", "Learning from Major Process Safety Incidents", { startsAt: daysAhead(4), durationMinutes: 60, speakerName: "Graham Whitfield", speakerTitle: "Principal Process Safety Engineer", speakerBio: "Leads the site process safety programme and facilitates HAZOP and LOPA studies.", synopsis: "A structured review of publicly reported industry incidents and the barrier failures behind them, related to our own operations.", objectives: ["Identify common barrier failures across major incidents.", "Relate incident lessons to unit-level barriers."], categoryId: webinarCat("process-safety-management"), cpdEligible: true, cpdValue: 1, minAttendanceMinutes: 45 });
  const wSteam = await mkWebinar("WEB-033", "Steam Trap Management and Energy Losses", { startsAt: daysAhead(21), durationMinutes: 45, speakerName: "Priya Natarajan", speakerTitle: "Reliability Engineer", speakerBio: "Leads the site steam trap survey programme.", synopsis: "How a structured steam trap programme quantifies and reduces losses, with results from the latest site survey.", objectives: ["Estimate losses from failed traps.", "Prioritise trap repairs by cost."], categoryId: webinarCat("utilities-and-energy-management"), cpdEligible: true, cpdValue: 0.75 });
  const wFull = await mkWebinar("WEB-034", "Supervisor Clinic: Difficult Conversations on Shift", { startsAt: daysAhead(14), durationMinutes: 60, speakerName: "Catherine Lowe", speakerTitle: "HR Director", speakerBio: "HR Director with a background in organisational psychology.", synopsis: "A small-group clinic for supervisors on structuring difficult conversations about performance and safety behaviours.", objectives: ["Structure a difficult conversation.", "Handle defensive responses."], categoryId: webinarCat("leadership-and-people-management"), capacity: 3, cpdEligible: false });
  const wLive = await mkWebinar("WEB-035", "Monthly HSE Stand-down: Hand and Finger Safety", { startsAt: new Date(NOW.getTime() - 20 * 60_000), durationMinutes: 60, speakerName: "Samuel Osei", speakerTitle: "HSE Advisor", speakerBio: "HSE advisor supporting refinery operations and maintenance.", synopsis: "Review of recent hand injuries across the industry and practical controls for line breaking and tool use.", objectives: ["Recognise pinch-point hazards.", "Select appropriate gloves for the task."], categoryId: webinarCat("health-safety-and-environment"), cpdEligible: true, cpdValue: 1, minAttendanceMinutes: 30 });
  const wMonte = await mkWebinar("WEB-028", "Monte Carlo Simulation for Turnaround Cost Estimates", { startsAt: daysAgo(30), durationMinutes: 60, status: "COMPLETED", speakerName: "James Okafor", speakerTitle: "Senior Process Engineer", speakerBio: "Leads probabilistic estimating for turnaround scope.", synopsis: "A worked example of probabilistic cost estimating for a turnaround, from input elicitation to P50/P90 contingency.", objectives: ["Elicit P10/P90 estimates.", "Interpret simulation output."], categoryId: webinarCat("quantitative-risk-analysis"), cpdEligible: true, cpdValue: 1, minAttendanceMinutes: 45 });
  const wAlarm = await mkWebinar("WEB-029", "Alarm Management Principles for Control Room Operators", { startsAt: daysAgo(12), durationMinutes: 50, status: "COMPLETED", speakerName: "Noura Aziz", speakerTitle: "Instrument Technician", speakerBio: "Supports the site alarm rationalisation project.", synopsis: "Principles of alarm philosophy, rationalisation and operator response, with lessons from the site alarm review.", objectives: ["Explain alarm priority and response time.", "Recognise nuisance and standing alarms."], categoryId: webinarCat("instrumentation-and-control"), cpdEligible: true, cpdValue: 0.75, minAttendanceMinutes: 40 });
  await mkWebinar("WEB-030", "Digital Twins for Refinery Optimisation", { startsAt: daysAhead(6), durationMinutes: 60, status: "CANCELLED", cancellationReason: "Speaker unavailable. The session will be rescheduled in the next quarter.", speakerName: "External speaker (to be confirmed)", synopsis: "Overview of digital twin applications in refinery optimisation.", categoryId: webinarCat("digital-transformation-and-ai") });

  await prisma.webinarRecording.create({ data: { webinarId: wMonte.id, title: "Full session recording", url: "https://stream.example.invalid/recordings/web-028", durationMinutes: 58, availableUntil: daysAhead(335) } });
  await prisma.webinarRecording.create({ data: { webinarId: wAlarm.id, title: "Full session recording", url: "https://stream.example.invalid/recordings/web-029", durationMinutes: 49, availableUntil: daysAhead(353) } });

  const reg = (w: { id: string }, email: string, at: Date, status: "REGISTERED" | "WAITLISTED" = "REGISTERED") => prisma.webinarRegistration.create({ data: { webinarId: w.id, userId: U(email), registeredAt: at, status } });
  for (const e of [james, priya, "elena.petrova@apex-demo.test", "marcus.bell@apex-demo.test", "peter.lindqvist@apex-demo.test"]) await reg(wReliability, e, daysAgo(between(1, 6)));
  for (const e of [daniel, aisha, lina, "yusuf.kareem@apex-demo.test", "samuel.osei@apex-demo.test", "tomasz.nowak@apex-demo.test"]) await reg(wSafety, e, daysAgo(between(1, 5)));
  for (const e of ["ravi.iyer@apex-demo.test", "ivan.horvat@apex-demo.test"]) await reg(wSteam, e, daysAgo(2));
  for (const e of ["tomasz.nowak@apex-demo.test", "omar.haddad@apex-demo.test", "ahmed.farouk@apex-demo.test"]) await reg(wFull, e, daysAgo(3));
  await reg(wFull, "yusuf.kareem@apex-demo.test", daysAgo(1), "WAITLISTED");
  for (const e of [aisha, daniel, "sofia.marin@apex-demo.test", "kwame.mensah@apex-demo.test"]) await reg(wLive, e, daysAgo(3));

  // Completed webinar with verified attendance and processed CPD
  const monteAttendees: [string, number | null][] = [[james, 60], [priya, 58], ["elena.petrova@apex-demo.test", 55], ["grace.adeyemi@apex-demo.test", 30], ["laura.schmidt@apex-demo.test", null]];
  for (const [email, minutes] of monteAttendees) {
    const r = await reg(wMonte, email, daysAgo(40));
    const attended = minutes != null;
    const att = await prisma.webinarAttendance.create({ data: { registrationId: r.id, webinarId: wMonte.id, userId: U(email), attended, attendedMinutes: minutes ?? 0, verification: "INSTRUCTOR_CONFIRMED", recordedById: admin, recordedAt: daysAgo(29), cpdProcessedAt: attended && minutes! >= 45 ? daysAgo(28) : null } });
    if (attended) await event(U(email), "WEBINAR_ATTENDED", `Attended ${wMonte.title} (${minutes} min, verified)`, daysAgo(30), ["webinar", wMonte.id]);
    if (attended && minutes! >= 45) {
      const pol = policyOf(email);
      const act = await prisma.cpdActivity.create({ data: { userId: U(email), title: wMonte.title, type: "WEBINAR", provider: wMonte.speakerName, activityDate: daysAgo(30), durationHours: minutes! / 60, webinarAttendanceId: att.id } });
      const auto = pol?.autoApproveVerifiedInternal ?? false;
      const claim = await prisma.cpdClaim.create({ data: { activityId: act.id, userId: U(email), periodId: periodNow.id, unit: pol?.unit ?? "HOURS", claimedValue: 1, approvedValue: 1, status: "APPROVED", submittedAt: daysAgo(28), decidedAt: daysAgo(auto ? 28 : 25), evidence: { create: { description: "Verified attendance (instructor confirmed)", reference: att.id } } } });
      await prisma.cpdApproval.createMany({ data: [{ claimId: claim.id, actorId: admin, fromStatus: "DRAFT", toStatus: "SUBMITTED", comment: "Raised from verified webinar attendance", createdAt: daysAgo(28) }, { claimId: claim.id, actorId: admin, fromStatus: "SUBMITTED", toStatus: "APPROVED", value: 1, createdAt: daysAgo(25) }] });
    }
  }
  await prisma.webinarFeedback.create({ data: { webinarId: wMonte.id, userId: U(james), rating: 5, relevance: 5, comments: "The worked contingency example was directly applicable to our next turnaround." } });
  await prisma.webinarFeedback.create({ data: { webinarId: wMonte.id, userId: U(priya), rating: 4, relevance: 4, comments: "Useful — would like a follow-up on schedule risk." } });
  // Completed webinar: registrations exist, attendance partially recorded, CPD NOT yet processed (admin workflow)
  for (const [email, minutes] of [[daniel, 50], [aisha, 48], ["yusuf.kareem@apex-demo.test", 20], ["noura.aziz@apex-demo.test", 50], ["kwame.mensah@apex-demo.test", null]] as [string, number | null][]) {
    const r = await reg(wAlarm, email, daysAgo(20));
    if (email !== "kwame.mensah@apex-demo.test" && email !== aisha) {
      await prisma.webinarAttendance.create({ data: { registrationId: r.id, webinarId: wAlarm.id, userId: U(email), attended: true, attendedMinutes: minutes, verification: "PLATFORM_RECORD", recordedById: admin, recordedAt: daysAgo(11), notes: "Imported from meeting attendance report (manual upload)." } });
      await event(U(email), "WEBINAR_ATTENDED", `Attended ${wAlarm.title} (${minutes} min, verified)`, daysAgo(12), ["webinar", wAlarm.id]);
    }
  }

  // ── Development plans
  const mkPlan = async (email: string, status: Prisma.DevelopmentPlanCreateInput["status"], target: string | null, title: string, aspiration: string, objectives: Omit<Prisma.DevelopmentObjectiveUncheckedCreateInput, "planId">[], reviewedAgo?: number) => {
    const plan = await prisma.developmentPlan.create({ data: { userId: U(email), reviewerId: omar, periodId: periodNow.id, targetJobRoleId: target ? jobRoles.get(target) : null, title, careerAspiration: aspiration, status, agreedAt: ["AGREED", "IN_PROGRESS", "COMPLETED"].includes(status!) ? daysAgo(reviewedAgo ?? 100) : null, lastReviewedAt: reviewedAgo != null ? daysAgo(reviewedAgo) : null, createdAt: daysAgo((reviewedAgo ?? 30) + 20) } });
    for (const [i, o] of objectives.entries()) await prisma.developmentObjective.create({ data: { ...o, planId: plan.id, sortOrder: i } });
    return plan;
  };
  const jPlan = await mkPlan(james, "IN_PROGRESS", "OSI", `${y} Development Plan — Operations leadership`, "Move from senior technical role to area operations leadership within three years.", [
    { goal: "Lead a cross-functional turnaround planning workstream", currentCapability: "Contributes technical scope to turnaround planning.", targetCapability: "Leads a workstream including schedule and cost risk.", competencyId: comps.get("RM-02"), competencyGap: "Project and schedule risk at Foundation; Practitioner required.", workplaceApplication: "Lead the hydrotreater catalyst change-out workstream.", responsible: "James Okafor with Omar Haddad", learningModel: "EXPERIENTIAL", targetDate: daysAhead(120), reviewDate: daysAhead(60), status: "IN_PROGRESS", managerFeedback: "Good progress on the scope freeze; keep the risk register live." },
    { goal: "Complete Leadership for Technical Professionals", currentCapability: "Informal coaching of graduates.", targetCapability: "Structured coaching and team leadership.", competencyId: comps.get("LD-01"), learningModel: "FORMAL", targetDate: daysAhead(45), status: "IN_PROGRESS" },
    { goal: "Shadow the operations superintendent for one shift cycle", targetCapability: "Understanding of area leadership decisions.", learningModel: "SOCIAL", targetDate: daysAgo(10), status: "NOT_STARTED", responsible: "Omar Haddad" },
  ], 80);
  await prisma.developmentAction.create({ data: { objectiveId: (await prisma.developmentObjective.findFirst({ where: { planId: jPlan.id, sortOrder: 1 } }))!.id, title: "Complete LDR-300", type: "COURSE", courseId: courses.get("LDR-300")!.id, dueDate: daysAhead(45) } });
  await prisma.developmentReview.create({ data: { planId: jPlan.id, actorId: omar, fromStatus: "MANAGER_REVIEW", toStatus: "AGREED", decision: "Manager Review → Agreed", comments: "Agreed. Strong plan with clear workplace application.", snapshot: { objectives: 3 }, version: 1, createdAt: daysAgo(100) } });
  await prisma.developmentReview.create({ data: { planId: jPlan.id, actorId: U(james), fromStatus: "AGREED", toStatus: "IN_PROGRESS", decision: "Agreed → In Progress", snapshot: { objectives: 3 }, version: 1, createdAt: daysAgo(98) } });

  const aPlan = await mkPlan(aisha, "MANAGER_REVIEW", "SO", `${y} Development Plan — Field operator sign-off`, "Achieve independent field operator sign-off and begin senior operator preparation.", [
    { goal: "Achieve field operator competence sign-off on the crude unit", currentCapability: "Performs rounds under supervision.", targetCapability: "Independent field operator on CDU.", competencyId: comps.get("PO-01"), competencyGap: "Foundation achieved; Practitioner required for Senior Operator.", workplaceApplication: "Independent night-shift rounds on CDU.", supportingEvidence: "Supervised rounds log; OPS-150 assignment.", responsible: "Aisha Rahman", learningModel: "EXPERIENTIAL", targetDate: daysAhead(75), reviewDate: daysAhead(30) },
    { goal: "Complete the Field Operator Development learning path", competencyId: comps.get("PS-01"), learningModel: "FORMAL", targetDate: daysAhead(75), responsible: "Aisha Rahman" },
    { goal: "Buddy with a senior operator during start-up activities", learningModel: "SOCIAL", targetDate: daysAhead(120), responsible: "Tomasz Nowak" },
  ]);
  await prisma.developmentReview.createMany({ data: [
    { planId: aPlan.id, actorId: U(aisha), fromStatus: "DRAFT", toStatus: "EMPLOYEE_REVIEW", decision: "Draft → Employee Review", snapshot: { objectives: 3 }, version: 1, createdAt: daysAgo(6) },
    { planId: aPlan.id, actorId: U(aisha), fromStatus: "EMPLOYEE_REVIEW", toStatus: "MANAGER_REVIEW", decision: "Employee Review → Manager Review", snapshot: { objectives: 3 }, version: 1, createdAt: daysAgo(4) },
  ] });
  await prisma.developmentComment.create({ data: { planId: aPlan.id, authorId: U(aisha), body: "I would like to target the senior operator path once sign-off is complete." , createdAt: daysAgo(4) } });

  await mkPlan(priya, "AGREED", "SPE", `${y} Development Plan — Reliability leadership`, "Develop towards a senior engineering role with a reliability specialism.", [
    { goal: "Lead the bad-actor elimination programme for pumps", competencyId: comps.get("ER-02"), learningModel: "EXPERIENTIAL", targetDate: daysAhead(150), status: "NOT_STARTED" },
    { goal: "Complete Six Sigma Green Belt", competencyId: comps.get("OE-03"), learningModel: "FORMAL", targetDate: daysAhead(90), status: "IN_PROGRESS" },
  ], 40);
  await mkPlan(daniel, "DRAFT", "SS", `${y} Development Plan`, "Prepare for an operations supervisor role.", [
    { goal: "Restore mandatory training compliance", learningModel: "FORMAL", targetDate: daysAhead(14) },
  ]);

  // ── Notifications (examples; the platform generates these from events)
  await prisma.notification.createMany({ data: [
    { userId: U(daniel), type: "MANDATORY_OVERDUE", title: "Mandatory training overdue", body: "H₂S Awareness and Respiratory Protection recertification is overdue.", link: "/my-learning?tab=mandatory", dedupeKey: "seed-overdue-1", createdAt: daysAgo(2) },
    { userId: U(lina), type: "ASSIGNMENT_NEW", title: "Mandatory training assigned", body: "H₂S Awareness and Respiratory Protection — due in 12 days.", link: "/my-learning?tab=mandatory", dedupeKey: "seed-assign-1", createdAt: daysAgo(18) },
    { userId: omar, type: "PLAN_REVIEW", title: "Development plan submitted for review", body: "Aisha Rahman has submitted a development plan for your review.", link: `/manager/team/${U(aisha)}?tab=plan`, dedupeKey: "seed-plan-1", createdAt: daysAgo(4) },
    { userId: U(priya), type: "CPD_DECISION", title: "CPD claim rejected", body: "Lunch-and-learn on lubrication: activity below minimum duration.", link: "/cpd", dedupeKey: "seed-cpd-1", createdAt: daysAgo(72), readAt: daysAgo(70) },
  ] });

  // ── Platform settings
  await prisma.platformSetting.create({ data: { key: "branding", value: { organisationName: "Meridian Energy (fictional demo)" } } });
  await prisma.auditLog.create({ data: { actorId: null, action: "seed.demo", entityType: "platform", entityId: null, metadata: { note: "Fictional demonstration data loaded" } } });

  console.log(`Seed complete: ${PEOPLE.length + 1} users, ${ALL_COURSES.length} courses, ${LEARNING_PATHS.length} learning paths.`);
  console.log(`Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
