import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { canViewEmployee, reportingScope } from "@/server/policy";
import { getClaim } from "@/server/services/cpd";
import { authoriseFile } from "@/server/services/files";
import { certificateFor } from "@/server/services/certificates";
import { competencyProfileFor, recordAssessment } from "@/server/services/competency";
import { assignLearning } from "@/server/services/assignments";
import { scopedExport, selfExport } from "@/server/services/exports";
import { setCourseStatus, createCourse } from "@/server/services/admin-courses";
import { actor, freshEmployee } from "./helpers";

describe("reporting scope", () => {
  it("includes direct and indirect reports only", async () => {
    const omar = await actor("omar.haddad@apex-demo.test");
    const scope = await reportingScope(omar.id);
    const ravi = await actor("ravi.iyer@apex-demo.test"); // reports to Tomasz, who reports to Omar
    const elena = await actor("elena.petrova@apex-demo.test"); // different line
    expect(scope).toContain(ravi.id);
    expect(scope).not.toContain(elena.id);
    expect(await canViewEmployee(omar, ravi.id)).toBe(true);
    expect(await canViewEmployee(omar, elena.id)).toBe(false);
  });

  it("denies employees and executives access to other individuals' records", async () => {
    const lina = await actor("lina.saleh@apex-demo.test");
    const exec = await actor("catherine.lowe@apex-demo.test");
    const priya = await actor("priya.natarajan@apex-demo.test");
    expect(await canViewEmployee(lina, priya.id)).toBe(false);
    expect(await canViewEmployee(exec, priya.id)).toBe(false);
    await expect(competencyProfileFor(lina, priya.id)).rejects.toThrow(/not found/);
    const claim = await prisma.cpdClaim.findFirstOrThrow({ where: { userId: priya.id } });
    await expect(getClaim(lina, claim.id)).rejects.toThrow(/not found/);
    await expect(getClaim(exec, claim.id)).rejects.toThrow(/not found/);
    const omar = await actor("omar.haddad@apex-demo.test");
    expect((await getClaim(omar, claim.id)).id).toBe(claim.id); // Priya is in Omar's line
  });

  it("protects private files and certificates from identifier guessing", async () => {
    const priya = await actor("priya.natarajan@apex-demo.test");
    const lina = await actor("lina.saleh@apex-demo.test");
    const evidence = await prisma.cpdEvidence.findFirstOrThrow({ where: { claim: { userId: priya.id }, fileId: { not: null } } });
    expect((await authoriseFile(priya, evidence.fileId!)).id).toBe(evidence.fileId);
    await expect(authoriseFile(lina, evidence.fileId!)).rejects.toThrow(/not found/);
    const cert = await prisma.certificate.findFirstOrThrow({ where: { userId: priya.id } });
    await expect(certificateFor(lina, cert.id)).rejects.toThrow(/not found/);
    expect((await certificateFor(priya, cert.id)).id).toBe(cert.id);
    // Course materials: enrolled learners only
    const material = await prisma.lessonResource.findFirstOrThrow({ include: { lesson: { include: { module: { include: { course: true } } } } }, where: { lesson: { module: { course: { code: "PSM-101" } } } } });
    await expect(authoriseFile(lina, material.fileId)).rejects.toThrow(/not found/);
    expect((await authoriseFile(priya, material.fileId)).id).toBe(material.fileId);
  });

  it("restricts manager actions to their scope and to non-mandatory assignments", async () => {
    const omar = await actor("omar.haddad@apex-demo.test");
    const elena = await actor("elena.petrova@apex-demo.test");
    const lina = await actor("lina.saleh@apex-demo.test");
    const course = await prisma.course.findUniqueOrThrow({ where: { code: "LSS-110" } });
    await expect(assignLearning(omar, { target: "USERS", userIds: [elena.id], courseId: course.id, kind: "REQUIRED" })).rejects.toThrow(/scope/);
    await expect(assignLearning(omar, { target: "USERS", userIds: [lina.id], courseId: course.id, kind: "REQUIRED", isMandatory: true, dueDate: new Date(Date.now() + 9e8) })).rejects.toThrow(/L&D/);
    await expect(assignLearning(omar, { target: "DEPARTMENT", departmentId: "x", courseId: course.id, kind: "REQUIRED" })).rejects.toThrow(/named team members/);
    const r = await assignLearning(omar, { target: "USERS", userIds: [lina.id], courseId: course.id, kind: "REQUIRED", dueDate: new Date(Date.now() + 9e8) });
    expect(r.created).toBe(1);
    expect(await prisma.enrollment.count({ where: { userId: lina.id, courseId: course.id, status: "ACTIVE" } })).toBe(1);
    const again = await assignLearning(omar, { target: "USERS", userIds: [lina.id], courseId: course.id, kind: "REQUIRED" });
    expect(again).toMatchObject({ created: 0, skipped: 1 });
    await expect(recordAssessment(omar, { userId: elena.id, competencyId: (await prisma.competency.findFirstOrThrow()).id, level: 2, method: "WORKPLACE_OBSERVATION", evidenceDescription: "Observed on shift." })).rejects.toThrow(/scope/);
    await expect(recordAssessment(lina, { userId: lina.id, competencyId: (await prisma.competency.findFirstOrThrow()).id, level: 5, method: "WORKPLACE_OBSERVATION", evidenceDescription: "Self assessment" })).rejects.toThrow(/own competence/);
  });

  it("lets administrators assign mandatory training to a whole department", async () => {
    const helen = await actor("helen.mercer@apex-demo.test");
    const dept = await prisma.department.findUniqueOrThrow({ where: { code: "LAB" } });
    const course = await prisma.course.findUniqueOrThrow({ where: { code: "ETH-100" } });
    const r = await assignLearning(helen, { target: "DEPARTMENT", departmentId: dept.id, courseId: course.id, kind: "REQUIRED", isMandatory: true, dueDate: new Date(Date.now() + 30 * 86_400_000), reason: "Annual ethics refresher" });
    expect(r.created + r.skipped).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { action: "assignment.mandatory.create", entityId: course.id } })).toBe(1);
  });

  it("scopes exports and enforces administrative permissions on the server", async () => {
    const lina = await actor("lina.saleh@apex-demo.test");
    const omar = await actor("omar.haddad@apex-demo.test");
    await expect(scopedExport(lina, "team-learning")).rejects.toThrow(/permission/);
    await expect(scopedExport(omar, "org-learning")).rejects.toThrow(/permission/);
    const team = await scopedExport(omar, "team-learning");
    const names = team.rows.slice(1).map((r) => r[0]);
    expect(names).toContain("Aisha Rahman");
    expect(names).not.toContain("Elena Petrova");
    const mine = await selfExport(lina, "history");
    expect(mine.rows.length).toBeGreaterThan(1);
    await expect(createCourse(omar, {})).rejects.toThrow(/permission/);
    const c = await prisma.course.findUniqueOrThrow({ where: { code: "PSM-101" } });
    await expect(setCourseStatus(lina, c.id, "ARCHIVED")).rejects.toThrow(/permission/);
  });

  it("allows a manager to view an employee in scope but executives see aggregates only", async () => {
    const fresh = await freshEmployee({ managerEmail: "omar.haddad@apex-demo.test" });
    const omar = await actor("omar.haddad@apex-demo.test");
    expect(await canViewEmployee(omar, fresh.id)).toBe(true);
    const exec = await actor("catherine.lowe@apex-demo.test");
    expect(exec.permissions.has("analytics.aggregate")).toBe(true);
    expect(exec.permissions.has("team.view")).toBe(false);
  });
});
