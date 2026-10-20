import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("employee journey: enrol, learn, pass, certify", async ({ page }) => {
  await login(page, "zainab.musa@apex-demo.test");
  await expect(page.getByRole("heading", { name: /Welcome back, Zainab/ })).toBeVisible();
  const completedBefore = Number(await page.locator("dt:has-text('Courses completed') + dd .type-figure").innerText());

  await page.getByRole("link", { name: "Course Catalogue" }).click();
  await page.getByLabel("Search", { exact: true }).fill("Upstream");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("link", { name: "Upstream Production Operations Overview" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Upstream Production Operations Overview" })).toBeVisible();
  await page.getByRole("button", { name: "Enrol" }).click();
  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
  await page.getByRole("link", { name: "Start course" }).click();

  // Complete reading lessons (server-recorded) until the assessment
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /Mark complete/ }).click();
    await page.waitForLoadState("networkidle");
  }
  await expect(page.getByText("Separation divides produced fluids into oil, gas and water.")).toBeVisible();
  await page.getByLabel("True").check();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.getByText("You have already passed this assessment.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Completed .* View certificate/)).toBeVisible();

  await page.goto("/certificates");
  await expect(page.getByRole("link", { name: "Upstream Production Operations Overview" })).toBeVisible();
  const pdf = await page.request.get(await page.getByRole("link", { name: "Download PDF" }).first().getAttribute("href") as string);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  await page.goto("/dashboard");
  await expect(page.locator("dt:has-text('Courses completed') + dd .type-figure")).toHaveText(String(completedBefore + 1));
  await page.goto("/history?type=COURSE_COMPLETED");
  await expect(page.getByText("Completed Upstream Production Operations Overview")).toBeVisible();
});

test("webinar journey: register, verified attendance, CPD", async ({ page, browser }) => {
  await login(page, "zainab.musa@apex-demo.test");
  await page.goto("/webinars");
  await page.getByRole("link", { name: /Monthly HSE Stand-down/ }).click();
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByText(/You are registered/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Registered", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Join session" })).toBeVisible();

  const admin = await (await browser.newContext()).newPage();
  await login(admin, "helen.mercer@apex-demo.test");
  await admin.goto("/admin/webinars");
  await admin.getByRole("link", { name: /Monthly HSE Stand-down/ }).click();
  await admin.getByRole("link", { name: /Registrations and attendance/ }).click();
  await admin.getByLabel("Zainab Musa attended").selectOption("yes");
  await admin.getByLabel("Zainab Musa minutes attended").fill("55");
  await admin.getByLabel("Verification method").selectOption("INSTRUCTOR_CONFIRMED");
  await admin.getByRole("button", { name: "Save attendance" }).click();
  await expect(admin.getByText(/Attendance recorded for 1 participant/)).toBeVisible();
  await admin.reload();
  await expect(admin.locator("tr", { hasText: "Zainab Musa" }).getByText("Instructor confirmed")).toBeVisible();
  await admin.getByRole("button", { name: "Process CPD" }).click();
  await expect(admin.getByText(/CPD processed: 1 claim/)).toBeVisible();

  await page.goto("/cpd");
  const row = page.locator("tr", { hasText: "Monthly HSE Stand-down" });
  await expect(row.getByText("Approved")).toBeVisible();
  await page.goto("/webinars?tab=mine");
  await expect(page.locator("tr", { hasText: "Monthly HSE Stand-down" }).getByText("Verified")).toBeVisible();
});

test("manager journey: review team and agree a development plan", async ({ page }) => {
  await login(page, "omar.haddad@apex-demo.test");
  await page.getByRole("link", { name: "Manager Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Overdue learning" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Daniel Reyes — / }).first()).toBeVisible();
  await page.getByRole("link", { name: /Review development plan — Aisha Rahman/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Aisha Rahman" })).toBeVisible();
  await page.getByLabel("Manager feedback").first().fill("Agree the CDU sign-off target; book rounds with Tomasz.");
  await page.getByRole("button", { name: "Save feedback" }).first().click();
  await expect(page.getByText("Feedback saved.")).toBeVisible();
  await page.getByLabel("Comment (optional)").fill("Plan agreed in our 1:1.");
  await page.getByRole("button", { name: "Agree plan" }).click();
  await expect(page.getByRole("button", { name: "Agree plan" })).toHaveCount(0);
  await expect(page.locator("[aria-current=step]")).toHaveText("Agreed");
  await expect(page.getByText("Plan agreed in our 1:1.")).toBeVisible();
});

test("administrator journey: build, publish and assign a course", async ({ page, browser }) => {
  const code = `E2E-${Date.now() % 100000}`;
  await login(page, "helen.mercer@apex-demo.test");
  await page.goto("/admin/courses/new");
  await page.getByLabel("Course code").fill(code);
  await page.getByLabel("Title").fill("Hydrogen Safety Essentials");
  await page.getByLabel("Synopsis").fill("Properties of hydrogen, leak detection and ignition control in hydroprocessing units.");
  await page.getByLabel("Overview").fill("Hydrogen has a wide flammable range and low ignition energy. This course explains the controls.");
  await page.getByLabel("Estimated study hours").fill("1");
  await page.getByRole("button", { name: "Create draft course" }).click();
  await expect(page.getByText("Draft created.")).toBeVisible();

  await page.getByLabel("Module title").last().fill("Hydrogen hazards");
  await page.getByRole("button", { name: "Add module" }).click();
  await expect(page.getByRole("heading", { name: "1. Hydrogen hazards" })).toBeVisible();
  await page.getByText("Add lesson to this module").click();
  await page.getByLabel("Lesson title").last().fill("Why hydrogen is different");
  await page.getByLabel(/Content \(Markdown/).last().fill("## Properties\n\nHydrogen burns with an almost invisible flame.");
  await page.getByLabel("Duration (minutes)").last().fill("15");
  await page.getByRole("button", { name: "Add lesson" }).click();
  await expect(page.getByText("Why hydrogen is different")).toBeVisible();

  await page.getByRole("link", { name: "Completion, CPD and enrolment" }).click();
  await page.getByLabel("Final assessment passed").uncheck();
  await page.getByRole("button", { name: "Save rules" }).click();
  await expect(page.getByText("Rules saved.")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();

  await page.goto("/manager/assign");
  await page.locator("select#item").selectOption({ label: `${code} — Hydrogen Safety Essentials` });
  await page.getByLabel(/Lina Saleh/).check();
  await page.locator("input#dueDate").fill(new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Create assignments" }).click();
  await expect(page.getByText(/1 assignment created/)).toBeVisible();

  const learner = await (await browser.newContext()).newPage();
  await login(learner, "lina.saleh@apex-demo.test");
  await learner.goto("/my-learning");
  await expect(learner.getByRole("link", { name: "Hydrogen Safety Essentials" })).toBeVisible();
  await learner.getByRole("link", { name: "Hydrogen Safety Essentials" }).click();
  await learner.getByRole("link", { name: "Start course" }).click();
  await expect(learner.getByText("Hydrogen burns with an almost invisible flame.")).toBeVisible();
});

test("authorisation: users cannot reach records outside their scope", async ({ page }) => {
  await login(page, "lina.saleh@apex-demo.test");
  await page.goto("/admin/courses");
  await expect(page).toHaveURL(/access-denied/);
  await page.goto("/manager");
  await expect(page).toHaveURL(/access-denied/);
  const api = await page.request.get("/api/v1/reports/analytics?scope=org");
  expect(api.status()).toBe(403);
  const cross = await page.request.post("/api/v1/enrollments", { data: { courseId: "x" }, headers: { Origin: "https://evil.example" } });
  expect(cross.status()).toBe(403);
  await page.context().clearCookies();
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
});

test("job-title access: promotion opens the next level only when an administrator grants it", async ({ page }) => {
  // Kwame's staff ID resolves to Senior Operator, but only Field Operator content has been opened.
  await login(page, "kwame.mensah@apex-demo.test");
  await expect(page.getByText("Next level awaiting admin").first()).toBeVisible();
  await page.goto("/catalogue?q=OPX-210");
  await expect(page.getByRole("link", { name: /Operational Excellence/ })).toHaveCount(0);
  expect((await page.request.get("/api/v1/courses/opx-210-operational-excellence-for-refinery-operations")).status()).toBe(404);

  await login(page, "helen.mercer@apex-demo.test");
  await page.goto("/admin/users?q=Kwame");
  await page.getByRole("link", { name: "Kwame Mensah" }).click();
  await expect(page.getByText("content for that level has not been granted yet")).toBeVisible();
  await page.getByLabel("Grant access to job title").selectOption({ label: "Senior Operator (grade 4)" });
  await page.getByLabel("Reason").fill("Promoted to Senior Operator");
  await page.getByRole("button", { name: "Grant access" }).click();
  await expect(page.getByRole("cell", { name: "Promoted to Senior Operator", exact: true })).toBeVisible();

  await login(page, "kwame.mensah@apex-demo.test");
  await page.goto("/catalogue?q=OPX-210");
  await expect(page.getByRole("link", { name: /Operational Excellence/ }).first()).toBeVisible();
});
