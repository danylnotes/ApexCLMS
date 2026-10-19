import { execSync } from "node:child_process";

/** Applies migrations to the test database and loads the demonstration seed as a fixture baseline. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://apex:apex_dev@localhost:5432/apex_lms_test?schema=public";
  if (!/test/.test(url)) throw new Error("Refusing to run tests against a database whose name does not contain 'test'.");
  const env = { ...process.env, DATABASE_URL: url, STORAGE_LOCAL_DIR: "./storage-test" };
  const onlyUnit = process.argv.some((a) => a.includes("tests/unit"));
  if (onlyUnit) return;
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
}
