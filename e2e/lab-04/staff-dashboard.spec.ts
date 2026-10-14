import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const password = "correct horse battery staple";
const staffEmail = "e2e-staff@example.test";
const requesterEmail = "e2e-desktop@example.test";

const signIn = async (page: Page, email: string): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

const openMetricCard = async (page: Page, label: string): Promise<number> => {
  const card = page
    .getByLabel("Ticket metrics")
    .getByRole("link", { name: new RegExp(`^${label}: \\d+$`, "u") });
  const name = (await card.getAttribute("aria-label")) ?? "";
  const count = Number(name.slice(name.lastIndexOf(" ") + 1));
  await card.click();
  return count;
};

test("staff drills into the unassigned active queue with the card total", async ({
  page,
}) => {
  await signIn(page, staffEmail);

  await expect(page).toHaveURL(/\/dashboard$/u);
  const count = await openMetricCard(page, "Active Unassigned");

  await expect(page).toHaveURL(/\/staff\/tickets\?/u);
  await expect(page).toHaveURL(/scope=active/u);
  await expect(page).toHaveURL(/owner=unassigned/u);
  await expect(
    page.getByRole("heading", { name: "Ticket Queue" })
  ).toBeVisible();
  await expect(page.locator(".result-count")).toHaveText(`${count} total`);
});

test("staff drills into a status queue with the card total", async ({
  page,
}) => {
  await signIn(page, staffEmail);

  await expect(page).toHaveURL(/\/dashboard$/u);
  const count = await openMetricCard(page, "New");

  await expect(page).toHaveURL(/currentStatus=New/u);
  await expect(page.locator(".result-count")).toHaveText(`${count} total`);
});

test("staff opens My Actions from the primary navigation", async ({ page }) => {
  await signIn(page, staffEmail);
  await expect(page).toHaveURL(/\/dashboard$/u);

  // Narrow viewports keep the links in a closed mobile menu.
  if (
    !(await page
      .getByRole("navigation", { name: "Primary navigation" })
      .isVisible())
  ) {
    await page.getByLabel("Open navigation").click();
  }
  await page
    .locator("nav:visible")
    .getByRole("link", { name: "My Actions" })
    .click();

  await expect(page).toHaveURL(/\/staff\/actions$/u);
  await expect(
    page.getByRole("heading", { exact: true, name: "My Actions" })
  ).toBeVisible();
});

test("requester is denied the staff My Actions page", async ({ page }) => {
  await signIn(page, requesterEmail);
  await expect(page).toHaveURL(/\/dashboard$/u);

  await page.goto("/staff/actions");

  await expect(
    page.getByRole("heading", { exact: true, name: "Access denied" })
  ).toBeVisible();
});
