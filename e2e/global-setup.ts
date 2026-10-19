import { execSync } from "node:child_process";

export default function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgresql://apex:apex_dev@localhost:5432/apex_lms_e2e?schema=public";
  if (!/e2e|test/.test(url)) throw new Error("E2E tests require a dedicated database.");
  const env = { ...process.env, DATABASE_URL: url, STORAGE_LOCAL_DIR: "./storage-e2e" };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
}
