import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { forbidden, invalid, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertCan, can, canOperateWebinars } from "../policy";
import { audit } from "../audit";
import { notify } from "../notify";
import { recordActivity } from "./activity";
import { currentPeriod } from "./periods";
import { claimableValue } from "@/lib/domain/cpd";

export type WebinarPhase = "UPCOMING" | "LIVE" | "COMPLETED" | "CANCELLED" | "DRAFT";

export function webinarPhase(w: { status: string; startsAt: Date; durationMinutes: number }, now = new Date()): WebinarPhase {
  if (w.status === "CANCELLED") return "CANCELLED";
  if (w.status === "DRAFT") return "DRAFT";
  const end = w.startsAt.getTime() + w.durationMinutes * 60_000;
  if (w.status === "COMPLETED" || now.getTime() > end) return "COMPLETED";
  if (now.getTime() >= w.startsAt.getTime() - 10 * 60_000) return "LIVE";
  return "UPCOMING";
}

export async function register(actor: Actor, webinarId: string) {
  assertCan(actor, "learning.self");
  const w = await prisma.webinar.findUnique({ where: { id: webinarId } });
  if (!w || w.status === "DRAFT") throw notFound("Webinar");
  const phase = webinarPhase(w);
  if (phase === "CANCELLED" || phase === "COMPLETED") throw invalid("Registration is closed for this webinar.");
  const existing = await prisma.webinarRegistration.findUnique({ where: { webinarId_userId: { webinarId, userId: actor.id } } });
  if (existing && existing.status !== "CANCELLED") return existing; // idempotent
  const reg = await prisma.$transaction(
    async (tx) => {
      const taken = await tx.webinarRegistration.count({ where: { webinarId, status: "REGISTERED" } });
      const status = w.capacity != null && taken >= w.capacity ? "WAITLISTED" : "REGISTERED";
      return existing
        ? tx.webinarRegistration.update({ where: { id: existing.id }, data: { status, registeredAt: new Date(), cancelledAt: null } })
        : tx.webinarRegistration.create({ data: { webinarId, userId: actor.id, status } });
    },
    { isolationLevel: "Serializable" },
  ).catch(async (e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034")) {
      return prisma.webinarRegistration.findUniqueOrThrow({ where: { webinarId_userId: { webinarId, userId: actor.id } } });
    }
    throw e;
  });
  await recordActivity(actor.id, "WEBINAR_REGISTERED", `Registered for ${w.title}${reg.status === "WAITLISTED" ? " (waitlist)" : ""}`, { type: "webinar", id: w.id });
  await notify(actor.id, {
    type: "WEBINAR_REGISTERED",
    title: reg.status === "WAITLISTED" ? "Added to webinar waitlist" : "Webinar registration confirmed",
    body: `${w.title} — ${w.startsAt.toUTCString()}.`,
    link: `/webinars/${w.slug}`,
    dedupeKey: `webinar-reg:${reg.id}:${reg.registeredAt.getTime()}`,
  });
  return reg;
}

export async function cancelRegistration(actor: Actor, webinarId: string) {
  const reg = await prisma.webinarRegistration.findUnique({ where: { webinarId_userId: { webinarId, userId: actor.id } }, include: { webinar: true } });
  if (!reg || reg.status === "CANCELLED") throw notFound("Registration");
  if (webinarPhase(reg.webinar) === "COMPLETED") throw invalid("You cannot cancel a registration after the event.");
  await prisma.$transaction(async (tx) => {
    await tx.webinarRegistration.update({ where: { id: reg.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    if (reg.status === "REGISTERED") {
      const next = await tx.webinarRegistration.findFirst({ where: { webinarId, status: "WAITLISTED" }, orderBy: { registeredAt: "asc" } });
      if (next) await tx.webinarRegistration.update({ where: { id: next.id }, data: { status: "REGISTERED" } });
    }
  });
}

export const attendanceSchema = z.object({
  webinarId: z.string(),
  entries: z.array(
    z.object({
      registrationId: z.string(),
      attended: z.boolean(),
      attendedMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
      verification: z.enum(["INSTRUCTOR_CONFIRMED", "PLATFORM_RECORD", "ADMIN_PROCESS", "UNVERIFIED"]),
      notes: z.string().max(500).optional().nullable(),
    }),
  ),
});

/**
 * Records attendance. Registration alone never creates attendance; an authorised user must
 * record it with a verification method. "UNVERIFIED" records are kept but are not CPD-eligible.
 */
export async function recordAttendance(actor: Actor, raw: unknown) {
  if (!canOperateWebinars(actor)) throw forbidden();
  const { webinarId, entries } = attendanceSchema.parse(raw);
  const w = await prisma.webinar.findUnique({ where: { id: webinarId } });
  if (!w) throw notFound("Webinar");
  if (w.startsAt.getTime() > Date.now()) throw invalid("Attendance can only be recorded once the webinar has started.");
  if (!can(actor, "webinar.manage") && entries.some((e) => e.verification === "ADMIN_PROCESS")) throw forbidden("Only webinar administrators can use the administrative process.");
  const regs = await prisma.webinarRegistration.findMany({ where: { webinarId, id: { in: entries.map((e) => e.registrationId) } }, include: { attendance: true } });
  const regMap = new Map(regs.map((r) => [r.id, r]));
  let count = 0;
  for (const e of entries) {
    const reg = regMap.get(e.registrationId);
    if (!reg) throw invalid("An attendance entry does not match a registration for this webinar.");
    if (reg.attendance?.cpdProcessedAt) continue; // finalised once CPD has been processed
    const data = {
      attended: e.attended,
      attendedMinutes: e.attended ? e.attendedMinutes ?? null : 0,
      verification: e.verification,
      recordedById: actor.id,
      recordedAt: new Date(),
      notes: e.notes ?? null,
    };
    await prisma.webinarAttendance.upsert({
      where: { registrationId: reg.id },
      create: { ...data, registrationId: reg.id, webinarId, userId: reg.userId },
      update: data,
    });
    if (e.attended && e.verification !== "UNVERIFIED" && !(reg.attendance?.attended && reg.attendance.verification !== "UNVERIFIED")) {
      await recordActivity(reg.userId, "WEBINAR_ATTENDED", `Attended ${w.title} (${e.attendedMinutes ?? "—"} min, verified)`, { type: "webinar", id: w.id });
    }
    count++;
  }
  await audit(actor.id, "webinar.attendance.record", "webinar", w.id, { entries: count });
  return { updated: count };
}

/** Raises CPD claims for verified, eligible attendance. Idempotent per attendance record. */
export async function processWebinarCpd(actor: Actor, webinarId: string) {
  assertCan(actor, "webinar.manage");
  const w = await prisma.webinar.findUnique({ where: { id: webinarId } });
  if (!w) throw notFound("Webinar");
  if (!w.cpdEligible || !w.cpdValue) throw invalid("This webinar is not configured for CPD.");
  const records = await prisma.webinarAttendance.findMany({
    where: { webinarId, attended: true, verification: { not: "UNVERIFIED" }, cpdProcessedAt: null },
    include: { user: { include: { profile: { include: { cpdPolicy: true } } } } },
  });
  const period = await currentPeriod();
  let processed = 0;
  let skipped = 0;
  for (const a of records) {
    if (w.minAttendanceMinutes && (a.attendedMinutes ?? 0) < w.minAttendanceMinutes) {
      skipped++;
      continue;
    }
    const policy = a.user.profile?.cpdPolicy ?? null;
    if (policy && policy.eligibleTypes.length && !policy.eligibleTypes.includes("WEBINAR")) {
      skipped++;
      continue;
    }
    const hours = Number(w.cpdValue);
    const value = claimableValue(hours, policy ? { unit: policy.unit, targetPerPeriod: null, pointsPerHour: policy.pointsPerHour ? Number(policy.pointsPerHour) : null, maxPerActivity: policy.maxPerActivity ? Number(policy.maxPerActivity) : null } : null);
    const auto = policy?.autoApproveVerifiedInternal ?? false;
    try {
      await prisma.$transaction(async (tx) => {
        const activity = await tx.cpdActivity.create({
          data: { userId: a.userId, title: w.title, type: "WEBINAR", provider: w.speakerName, activityDate: w.startsAt, durationHours: (a.attendedMinutes ?? w.durationMinutes) / 60, description: w.synopsis, webinarAttendanceId: a.id },
        });
        const claim = await tx.cpdClaim.create({
          data: {
            activityId: activity.id,
            userId: a.userId,
            periodId: period?.id,
            unit: policy?.unit ?? w.cpdUnit,
            claimedValue: value,
            approvedValue: auto ? value : null,
            status: auto ? "APPROVED" : "SUBMITTED",
            submittedAt: new Date(),
            decidedAt: auto ? new Date() : null,
            evidence: { create: { description: `Verified attendance (${a.verification.replace(/_/g, " ").toLowerCase()})`, reference: a.id } },
          },
        });
        await tx.cpdApproval.create({ data: { claimId: claim.id, actorId: actor.id, fromStatus: "DRAFT", toStatus: "SUBMITTED", comment: "Raised from verified webinar attendance" } });
        if (auto) await tx.cpdApproval.create({ data: { claimId: claim.id, actorId: actor.id, fromStatus: "SUBMITTED", toStatus: "APPROVED", value, comment: `Auto-approved under policy "${policy!.name}"` } });
        await tx.webinarAttendance.update({ where: { id: a.id }, data: { cpdProcessedAt: new Date() } });
      });
      processed++;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // already processed concurrently
      throw e;
    }
  }
  await audit(actor.id, "webinar.cpd.process", "webinar", w.id, { processed, skipped });
  return { processed, skipped };
}

export const feedbackSchema = z.object({
  webinarId: z.string(),
  rating: z.coerce.number().int().min(1).max(5),
  relevance: z.coerce.number().int().min(1).max(5).optional(),
  comments: z.string().trim().max(2000).optional(),
});

export async function submitFeedback(actor: Actor, raw: unknown) {
  const f = feedbackSchema.parse(raw);
  const reg = await prisma.webinarRegistration.findUnique({ where: { webinarId_userId: { webinarId: f.webinarId, userId: actor.id } }, include: { attendance: true } });
  if (!reg?.attendance?.attended) throw forbidden("Feedback is available to attendees only.");
  return prisma.webinarFeedback.upsert({
    where: { webinarId_userId: { webinarId: f.webinarId, userId: actor.id } },
    create: { webinarId: f.webinarId, userId: actor.id, rating: f.rating, relevance: f.relevance, comments: f.comments },
    update: { rating: f.rating, relevance: f.relevance, comments: f.comments },
  });
}

/** iCalendar export for a single webinar (RFC 5545). */
export function webinarIcs(w: { id: string; title: string; synopsis: string; startsAt: Date; durationMinutes: number; slug: string }, appUrl: string) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const end = new Date(w.startsAt.getTime() + w.durationMinutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apex CLMS//Webinars//EN",
    "BEGIN:VEVENT",
    `UID:${w.id}@apex-learning`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(w.startsAt)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(w.title)}`,
    `DESCRIPTION:${esc(w.synopsis)}`,
    `URL:${appUrl}/webinars/${w.slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
