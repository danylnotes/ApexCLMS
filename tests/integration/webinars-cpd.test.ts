import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as webinars from "@/server/services/webinars";
import * as cpd from "@/server/services/cpd";
import { actor, freshEmployee } from "./helpers";

describe("webinars and attendance", () => {
  it("registers idempotently and waitlists beyond capacity", async () => {
    const full = await prisma.webinar.findUniqueOrThrow({ where: { code: "WEB-034" } });
    const me = await freshEmployee();
    const r1 = await webinars.register(me, full.id);
    const r2 = await webinars.register(me, full.id);
    expect(r1.id).toBe(r2.id);
    expect(r1.status).toBe("WAITLISTED");
  });

  it("never treats registration as attendance and requires an authorised recorder", async () => {
    const w = await prisma.webinar.findUniqueOrThrow({ where: { code: "WEB-029" } });
    const aisha = await actor("aisha.rahman@apex-demo.test");
    const reg = await prisma.webinarRegistration.findUniqueOrThrow({ where: { webinarId_userId: { webinarId: w.id, userId: aisha.id } }, include: { attendance: true } });
    expect(reg.attendance).toBeNull();
    await expect(webinars.recordAttendance(aisha, { webinarId: w.id, entries: [{ registrationId: reg.id, attended: true, attendedMinutes: 50, verification: "INSTRUCTOR_CONFIRMED" }] })).rejects.toThrow(/permission/);
    const graham = await actor("graham.whitfield@apex-demo.test"); // instructor
    await expect(webinars.recordAttendance(graham, { webinarId: w.id, entries: [{ registrationId: reg.id, attended: true, attendedMinutes: 50, verification: "ADMIN_PROCESS" }] })).rejects.toThrow(/administrators/);
    await webinars.recordAttendance(graham, { webinarId: w.id, entries: [{ registrationId: reg.id, attended: true, attendedMinutes: 50, verification: "INSTRUCTOR_CONFIRMED" }] });
    const att = await prisma.webinarAttendance.findUniqueOrThrow({ where: { registrationId: reg.id } });
    expect(att).toMatchObject({ attended: true, verification: "INSTRUCTOR_CONFIRMED", recordedById: graham.id });
  });

  it("rejects attendance before the session starts", async () => {
    const w = await prisma.webinar.findUniqueOrThrow({ where: { code: "WEB-031" }, include: { registrations: true } });
    const helen = await actor("helen.mercer@apex-demo.test");
    await expect(webinars.recordAttendance(helen, { webinarId: w.id, entries: [{ registrationId: w.registrations[0].id, attended: true, verification: "ADMIN_PROCESS" }] })).rejects.toThrow(/started/);
  });

  it("processes CPD once for verified attendance meeting the minimum", async () => {
    const w = await prisma.webinar.findUniqueOrThrow({ where: { code: "WEB-029" } });
    const helen = await actor("helen.mercer@apex-demo.test");
    const first = await webinars.processWebinarCpd(helen, w.id);
    expect(first.processed).toBeGreaterThanOrEqual(2);
    expect(first.skipped).toBeGreaterThanOrEqual(1); // Yusuf attended 20 of a required 40 minutes
    const second = await webinars.processWebinarCpd(helen, w.id);
    expect(second.processed).toBe(0);
    const yusuf = await actor("yusuf.kareem@apex-demo.test");
    expect(await prisma.cpdActivity.count({ where: { userId: yusuf.id, webinarAttendance: { webinarId: w.id } } })).toBe(0);
    const aisha = await actor("aisha.rahman@apex-demo.test");
    const claim = await prisma.cpdClaim.findFirstOrThrow({ where: { userId: aisha.id, activity: { webinarAttendance: { webinarId: w.id } } } });
    expect(claim.status).toBe("APPROVED"); // technical staff policy auto-approves verified internal learning
  });
});

describe("CPD claims", () => {
  it("runs Draft → Submitted → Under review → Approved with an auditable history", async () => {
    const me = await freshEmployee({ policy: "Engineering Professional Registration" });
    const claim = await cpd.createClaim(me, { title: "Pressure relief design seminar", type: "TECHNICAL_SEMINAR", provider: "Institute", activityDate: new Date(Date.now() - 86_400_000).toISOString(), durationHours: 3, claimedValue: 3, description: "Seminar on relief system design basis.", learningOutcomes: "Understood fire case sizing and inlet losses.", submit: false });
    expect(claim.status).toBe("DRAFT");
    await cpd.ownerTransition(me, claim.id, "SUBMITTED");
    const helen = await actor("helen.mercer@apex-demo.test");
    await expect(cpd.reviewClaim(helen, { claimId: claim.id, decision: "APPROVED", approvedValue: 5 })).rejects.toThrow(/exceed/);
    await cpd.reviewClaim(helen, { claimId: claim.id, decision: "APPROVED", approvedValue: 2.5, comment: "Partial — one session was networking." });
    const c = await prisma.cpdClaim.findUniqueOrThrow({ where: { id: claim.id }, include: { approvals: true } });
    expect(c.status).toBe("APPROVED");
    expect(Number(c.approvedValue)).toBe(2.5);
    expect(c.approvals.map((a) => `${a.fromStatus}>${a.toStatus}`)).toEqual(["DRAFT>SUBMITTED", "SUBMITTED>UNDER_REVIEW", "UNDER_REVIEW>APPROVED"]);
    await expect(cpd.ownerTransition(me, claim.id, "DRAFT")).rejects.toThrow(/cannot move/);
  });

  it("requires a reason to reject and lets the owner revise", async () => {
    const me = await freshEmployee();
    const claim = await cpd.createClaim(me, { title: "Short webinar", type: "OTHER", activityDate: new Date().toISOString(), durationHours: 1, claimedValue: 1, description: "External vendor webinar.", learningOutcomes: "Product familiarisation only.", submit: true });
    const helen = await actor("helen.mercer@apex-demo.test");
    await expect(cpd.reviewClaim(helen, { claimId: claim.id, decision: "REJECTED", comment: "" })).rejects.toThrow(/reason/);
    await cpd.reviewClaim(helen, { claimId: claim.id, decision: "REJECTED", comment: "Product marketing is not CPD." });
    await cpd.ownerTransition(me, claim.id, "DRAFT");
    expect((await prisma.cpdClaim.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe("DRAFT");
  });

  it("prevents self-approval, approval without permission and claims above the policy cap", async () => {
    const helen = await actor("helen.mercer@apex-demo.test");
    const own = await cpd.createClaim(helen, { title: "Conference", type: "CONFERENCE", activityDate: new Date().toISOString(), durationHours: 2, claimedValue: 2, description: "Learning conference.", learningOutcomes: "Evaluation methods.", submit: true });
    await expect(cpd.reviewClaim(helen, { claimId: own.id, decision: "APPROVED", approvedValue: 2 })).rejects.toThrow(/own/);
    const omar = await actor("omar.haddad@apex-demo.test");
    await expect(cpd.reviewClaim(omar, { claimId: own.id, decision: "APPROVED", approvedValue: 2 })).rejects.toThrow(/permission/);
    const tech = await freshEmployee({ policy: "Operations & Technical Staff CPD" });
    await expect(cpd.createClaim(tech, { title: "Long course", type: "EXTERNAL_TRAINING", activityDate: new Date().toISOString(), durationHours: 20, claimedValue: 20, description: "Week-long course.", learningOutcomes: "Many outcomes listed here.", submit: true })).rejects.toThrow(/cannot exceed 8/);
  });
});
