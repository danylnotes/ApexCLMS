import { defineConfig, devices } from "@playwright/test";

const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgresql://apex:apex_dev@localhost:5432/apex_lms_e2e?schema=public";
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/v1/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: E2E_DB, STORAGE_LOCAL_DIR: "./storage-e2e", DEMO_MODE: "true", NEXT_DIST_DIR: ".next-e2e" },
  },
});
