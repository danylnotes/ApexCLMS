import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const COST = 12;
export const hashPassword = (pw: string) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

/** Corporate password policy: 12+ characters including upper, lower, digit and symbol. */
export function passwordPolicyErrors(pw: string): string[] {
  const e: string[] = [];
  if (pw.length < 12) e.push("at least 12 characters");
  if (!/[a-z]/.test(pw)) e.push("a lowercase letter");
  if (!/[A-Z]/.test(pw)) e.push("an uppercase letter");
  if (!/[0-9]/.test(pw)) e.push("a number");
  if (!/[^A-Za-z0-9]/.test(pw)) e.push("a symbol");
  return e;
}
