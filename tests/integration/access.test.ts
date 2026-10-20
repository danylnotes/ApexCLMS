import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { searchCatalogue } from "@/server/services/catalogue";
import { canAccessCourse, canAccessPath, grantContentAccess, revokeContentAccess, accessSummary } from "@/server/services/access";
import { enrol } from "@/server/services/learning";
import { assignLearning } from "@/server/services/assignments";
import { createUser, updateUser } from "@/server/services/admin-org";
import { actor, course, freshEmployee } from "./helpers";

const ADMIN = "helen.mercer@apex-demo.test";

describe("job-title content access", () => {
  it("hides courses intended for other job titles from the catalogue and course pages", async () => {
    const lina = await actor("lina.saleh@apex-demo.test"); // Field Operator
    const codes = (await searchCatalogue(lina.id, { pageSize: 100 })).items.map((c) => c.code);
    expect(codes).toContain("HSE-110"); // open to every job title
    expect(codes).toContain("OPS-150"); // field operator content
    expect(codes).not.toContain("LDR-300"); // supervisor content
    const sup = await course("LDR-300");
    expect(await canAccessCourse(lina.id, sup.id)).toBe(false);
    await expect(enrol(lina, sup.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not open the next level on promotion until an administrator grants it", async () => {
    const admin = await actor(ADMIN);
    const kwame = await actor("kwame.mensah@apex-demo.test"); // promoted FO → SO in the seed
    const summary = await accessSummary(kwame.id);
    expect(summary.jobRole?.code).toBe("SO");
    expect(summary.pendingCurrentRole).toBe(true);
    const opx = await course("OPX-210"); // Senior Operator content
    expect(await canAccessCourse(kwame.id, opx.id)).toBe(false);

    const so = await prisma.jobRole.findUniqueOrThrow({ where: { code: "SO" } });
    const grant = await grantContentAccess(admin, kwame.id, so.id, "Promoted to Senior Operator");
    expect(await canAccessCourse(kwame.id, opx.id)).toBe(true);
    expect(await prisma.notification.count({ where: { userId: kwame.id, dedupeKey: `grant:${grant.id}` } })).toBe(1);
    await expect(grantContentAccess(admin, kwame.id, so.id)).rejects.toMatchObject({ code: "CONFLICT" });

    await revokeContentAccess(admin, grant.id);
    expect(await canAccessCourse(kwame.id, opx.id)).toBe(false);
  });

  it("only administrators may grant access", async () => {
    const omar = await actor("omar.haddad@apex-demo.test");
    const lina = await actor("lina.saleh@apex-demo.test");
    const so = await prisma.jobRole.findUniqueOrThrow({ where: { code: "SO" } });
    await expect(grantContentAccess(omar, lina.id, so.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(grantContentAccess(lina, lina.id, so.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("changing a job title records the change without granting content", async () => {
    const admin = await actor(ADMIN);
    const emp = await freshEmployee({ roleCode: "FO" });
    const [so, profile] = await Promise.all([prisma.jobRole.findUniqueOrThrow({ where: { code: "SO" } }), prisma.userProfile.findUniqueOrThrow({ where: { userId: emp.id } })]);
    const r = await updateUser(admin, emp.id, { name: emp.name, email: emp.email, employeeNumber: profile.employeeNumber, jobRoleId: so.id, roleKeys: ["EMPLOYEE"] });
    expect(r.jobTitleChanged).toBe(true);
    expect(await prisma.contentAccessGrant.count({ where: { userId: emp.id, jobRoleId: so.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "user.job_title.change", entityId: emp.id } })).toBe(1);
  });

  it("requires a unique staff ID and opens the starting job title on creation", async () => {
    const admin = await actor(ADMIN);
    const fo = await prisma.jobRole.findUniqueOrThrow({ where: { code: "FO" } });
    const base = { name: "New Operator", jobRoleId: fo.id, roleKeys: ["EMPLOYEE"] };
    await expect(createUser(admin, { ...base, email: `no.id.${Date.now()}@apex-demo.test`, employeeNumber: "" }, { invite: false })).rejects.toThrow();
    await expect(createUser(admin, { ...base, email: `dup.id.${Date.now()}@apex-demo.test`, employeeNumber: "D-20101" }, { invite: false })).rejects.toMatchObject({ code: "CONFLICT" });
    const { user } = await createUser(admin, { ...base, email: `new.op.${Date.now()}@apex-demo.test`, employeeNumber: `n-${Date.now()}` }, { invite: false });
    const p = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(p.employeeNumber).toMatch(/^N-/);
    expect(await prisma.contentAccessGrant.count({ where: { userId: user.id, jobRoleId: fo.id } })).toBe(1);
  });

  it("refuses to assign restricted content to named staff without access, and skips them for audiences", async () => {
    const admin = await actor(ADMIN);
    const emp = await freshEmployee({ roleCode: "FO" });
    const sup = await course("LDR-300");
    await expect(assignLearning(admin, { target: "USERS", userIds: [emp.id], courseId: sup.id, kind: "RECOMMENDED" })).rejects.toThrow(/administrator must grant access/);
    const fo = await prisma.jobRole.findUniqueOrThrow({ where: { code: "FO" } });
    const r = await assignLearning(admin, { target: "JOB_ROLE", jobRoleId: fo.id, courseId: sup.id, kind: "RECOMMENDED" });
    expect(r.created).toBe(0);
    expect(r.noAccess).toBeGreaterThan(0);
  });

  it("keeps learning records visible and lets content administrators see everything", async () => {
    const admin = await actor(ADMIN);
    const all = await searchCatalogue(admin.id, { pageSize: 100 });
    expect(all.items.map((c) => c.code)).toContain("LDR-300");
    const sofia = await actor("sofia.marin@apex-demo.test"); // Field Operator with a pending LSS-300 request
    expect(await canAccessCourse(sofia.id, (await course("LSS-300")).id)).toBe(true);
    const lina = await actor("lina.saleh@apex-demo.test");
    const sod = await prisma.learningPath.findUniqueOrThrow({ where: { code: "LP-SOD" } });
    expect(await canAccessPath(lina.id, sod)).toBe(false);
  });
});
