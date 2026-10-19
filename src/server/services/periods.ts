import { prisma, type Tx } from "../db";

/** The reporting period flagged current, or the period containing today. */
export async function currentPeriod(tx: Tx = prisma) {
  const flagged = await tx.reportingPeriod.findFirst({ where: { isCurrent: true } });
  if (flagged) return flagged;
  const now = new Date();
  return tx.reportingPeriod.findFirst({ where: { startDate: { lte: now }, endDate: { gte: now } } });
}
