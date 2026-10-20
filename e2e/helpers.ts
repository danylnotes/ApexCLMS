import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Demo#Apex2026!";

/** Fictional demo personas sign in with their staff IDs. */
export const STAFF_IDS: Record<string, string> = {
  "helen.mercer@apex-demo.test": "D-10001",
  "catherine.lowe@apex-demo.test": "D-10002",
  "omar.haddad@apex-demo.test": "D-10003",
  "graham.whitfield@apex-demo.test": "D-10004",
  "lina.saleh@apex-demo.test": "D-20101",
  "james.okafor@apex-demo.test": "D-20102",
  "daniel.reyes@apex-demo.test": "D-20103",
  "aisha.rahman@apex-demo.test": "D-20104",
  "priya.natarajan@apex-demo.test": "D-20105",
  "kwame.mensah@apex-demo.test": "D-20109",
  "hassan.jaber@apex-demo.test": "D-20206",
  "zainab.musa@apex-demo.test": "D-20213",
};

export async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Staff ID").fill(STAFF_IDS[email] ?? email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
