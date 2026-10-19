import { prisma } from "./db";

/**
 * Email delivery. The "outbox" provider records every message in email_outbox (and the server log)
 * — suitable for development and for environments where a relay polls the outbox.
 * SMTP/Graph delivery is a documented integration point (docs/DEPLOYMENT.md): when EMAIL_PROVIDER
 * is set to anything else, messages are queued in the outbox and NOT reported as sent.
 */
export async function sendEmail(to: string, subject: string, body: string) {
  const provider = process.env.EMAIL_PROVIDER ?? "outbox";
  if (provider === "outbox") {
    if (process.env.NODE_ENV !== "test") console.info(`[email:outbox] to=${to} subject="${subject}"`);
    return prisma.emailOutbox.create({ data: { toAddress: to, subject, body, provider, status: "SENT", sentAt: new Date() } });
  }
  console.warn(`[email] provider "${provider}" is not implemented; message queued in outbox.`);
  return prisma.emailOutbox.create({ data: { toAddress: to, subject, body, provider, status: "QUEUED" } });
}
