import type { ActivityType, Prisma } from "@prisma/client";
import { prisma, type Tx } from "../db";

export async function recordActivity(
  userId: string,
  type: ActivityType,
  summary: string,
  ref?: { type: string; id: string },
  metadata?: Prisma.InputJsonValue,
  tx: Tx = prisma,
) {
  await tx.learningActivityEvent.create({
    data: { userId, type, summary, refType: ref?.type, refId: ref?.id, metadata },
  });
}
