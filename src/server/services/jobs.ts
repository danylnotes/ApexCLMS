import { prisma } from "../db";
import { notify } from "../notify";
import { loadSettingsUncached } from "../settings";

/**
 * Scheduled processes. Run periodically (e.g. hourly) via `npm run jobs:run` or
 * POST /api/v1/jobs/run with the JOBS_SECRET. Every notification uses a dedupe key so
 * repeated runs never notify twice for the same event.
 */
export async function runScheduledJobs(now = new Date()) {
  const run = await prisma.jobRun.create({ data: { job: "scheduled", status: "RUNNING" } });
  const settings = await loadSettingsUncached();
  const result: Record<string, number> = {};
  try {
    // 1. Deadlines approaching (7 days) and overdue assignments
    const open = await prisma.learningAssignment.findMany({
      where: { status: "ASSIGNED", dueDate: { not: null } },
      include: { course: { select: { title: true, slug: true } }, path: { select: { title: true, slug: true } } },
    });
    let approaching = 0;
    let overdue = 0;
    for (const a of open) {
      const due = a.dueDate!;
      const title = a.course?.title ?? a.path?.title ?? "Assigned learning";
      const link = a.course ? `/courses/${a.course.slug}` : `/learning-paths/${a.path?.slug}`;
      const msLeft = due.getTime() - now.getTime();
      if (msLeft < 0) {
        // One overdue reminder per assignment per ISO week.
        const week = Math.floor(now.getTime() / (7 * 86_400_000));
        if (await notify(a.userId, { type: "MANDATORY_OVERDUE", title: a.isMandatory ? "Mandatory training overdue" : "Assigned learning overdue", body: `${title} was due on ${due.toISOString().slice(0, 10)}.`, link, dedupeKey: `overdue:${a.id}:w${week}` })) overdue++;
      } else if (msLeft <= 7 * 86_400_000) {
        if (await notify(a.userId, { type: "DEADLINE_APPROACHING", title: "Deadline approaching", body: `${title} is due on ${due.toISOString().slice(0, 10)}.`, link, dedupeKey: `due-soon:${a.id}` })) approaching++;
      }
    }
    result.deadlineReminders = approaching;
    result.overdueReminders = overdue;

    // 2. Webinar reminders
    const horizon = new Date(now.getTime() + settings.notifications.webinarReminderHours * 3_600_000);
    const regs = await prisma.webinarRegistration.findMany({
      where: { status: "REGISTERED", webinar: { status: "SCHEDULED", startsAt: { gt: now, lte: horizon } } },
      include: { webinar: true },
    });
    let reminders = 0;
    for (const r of regs) {
      if (await notify(r.userId, { type: "WEBINAR_UPCOMING", title: "Upcoming webinar", body: `${r.webinar.title} starts ${r.webinar.startsAt.toUTCString()}.`, link: `/webinars/${r.webinar.slug}`, dedupeKey: `webinar-reminder:${r.id}` })) reminders++;
    }
    result.webinarReminders = reminders;

    // 3. Mark finished webinars completed
    const finished = await prisma.webinar.findMany({ where: { status: "SCHEDULED", startsAt: { lt: now } } });
    let closed = 0;
    for (const w of finished) {
      if (w.startsAt.getTime() + w.durationMinutes * 60_000 < now.getTime()) {
        await prisma.webinar.update({ where: { id: w.id }, data: { status: "COMPLETED" } });
        closed++;
      }
    }
    result.webinarsClosed = closed;

    // 4. Certificate expiry warnings
    const expiring = await prisma.certificate.findMany({
      where: { status: "VALID", expiresAt: { gt: now, lte: new Date(now.getTime() + settings.health.expiringDays * 86_400_000) } },
      include: { course: { select: { title: true, slug: true } } },
    });
    let expiryNotices = 0;
    for (const c of expiring) {
      if (await notify(c.userId, { type: "DEADLINE_APPROACHING", title: "Certificate expiring", body: `Your ${c.course.title} certificate expires on ${c.expiresAt!.toISOString().slice(0, 10)}. Recertification is required.`, link: `/courses/${c.course.slug}`, dedupeKey: `cert-expiry:${c.id}` })) expiryNotices++;
    }
    result.certificateExpiryNotices = expiryNotices;

    // 5. Competency reassessments falling due
    const reassess = await prisma.competencyAssessment.findMany({
      where: { status: "CURRENT", reassessmentDue: { lte: new Date(now.getTime() + 30 * 86_400_000) } },
      include: { competency: true },
    });
    let reassessNotices = 0;
    for (const a of reassess) {
      if (await notify(a.userId, { type: "COMPETENCY_REVIEW", title: "Competency reassessment due", body: `${a.competency.name} is due for reassessment on ${a.reassessmentDue!.toISOString().slice(0, 10)}.`, link: "/competencies", dedupeKey: `reassess:${a.id}` })) reassessNotices++;
    }
    result.reassessmentNotices = reassessNotices;

    // 6. Housekeeping: expired sessions and rate-limit buckets
    result.sessionsPurged = (await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } } })).count;
    result.rateBucketsPurged = (await prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86_400_000) } } })).count;

    await prisma.jobRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", finishedAt: new Date(), detail: result } });
    return result;
  } catch (e) {
    await prisma.jobRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), detail: { error: String(e) } } });
    throw e;
  }
}
