import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./db";

/** Records a sensitive action. Metadata must never contain secrets or free-text personal data beyond what is needed. */
export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Prisma.InputJsonValue,
  tx: Tx = prisma,
  ip?: string | null,
) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, metadata, ip: ip ?? null } });
}
