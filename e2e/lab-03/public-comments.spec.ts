import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const requesterEmailBySlug: Record<string, string> = {
  "desktop-chromium": "e2e-desktop@example.test",
  "mobile-chromium": "e2e-mobile@example.test",
  "tablet-chromium": "e2e-tablet@example.test",
};
const requesterPassword = "correct horse battery staple";
const staffEmail = "e2e-staff@example.test";

const projectSlug = (projectName: string) =>
  projectName.replaceAll(/[^a-z0-9]+/giu, "-").toLowerCase();

const logIn = async (page: Page, email: string) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(requesterPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
};

const logOut = async (page: Page) => {
  const mobileNavigation = page.locator(".mobile-nav");

  if (await mobileNavigation.isVisible()) {
    await mobileNavigation.locator("summary").click();
    await mobileNavigation.getByRole("button", { name: "Log out" }).click();
    return;
  }

  await page
    .locator(".account-chip")
    .getByRole("button", { name: "Log out" })
    .click();
};

test("keeps the Requester and IT Staff public conversation shared", async ({
  page,
}, testInfo) => {
  const requesterEmail =
    requesterEmailBySlug[projectSlug(testInfo.project.name)] ??
    "e2e-desktop@example.test";
  const uniqueId = `${Date.now()}-${testInfo.workerIndex}`;
  const summary = `E2E public comments flow ${uniqueId}`;
  const requesterComment = `Requester update ${uniqueId}`;
  const staffComment = `Staff update ${uniqueId}`;

  await logIn(page, requesterEmail);
  await expect(page).toHaveURL(/\/tickets$/u);
  await page.getByRole("button", { name: /Create Ticket/u }).click();
  await expect(
    page.getByRole("heading", { name: "Create Ticket" })
  ).toBeVisible();
  await expect(page.locator("#categoryId")).toContainText("Account and Access");
  await page.locator("#categoryId").selectOption("1");
  await page.locator("#relatedSystemId").selectOption("1");
  await page.getByLabel("Ticket Summary").fill(summary);
  await page.getByLabel("Requested Priority").selectOption("Medium");
  await page
    .getByLabel("Description")
    .fill(
      "The public conversation needs a shared Requester and staff journey."
    );
  await page
    .getByRole("button", { exact: true, name: "Create Ticket" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Ticket created" })
  ).toBeVisible();
  const ticketNumber = await page
    .locator(".created-ticket-number strong")
    .textContent();
  if (ticketNumber === null) {
    throw new Error("Created Ticket Number was not rendered.");
  }
  await page.getByRole("button", { name: "Go to My Tickets" }).click();
  const ticketLink = page.getByRole("link", { name: ticketNumber });
  await expect(ticketLink).toBeVisible();
  const ticketHref = await ticketLink.getAttribute("href");
  if (ticketHref === null) {
    throw new Error("Created Ticket link did not include a detail URL.");
  }
  await ticketLink.click();
  await expect(
    page.getByRole("heading", { name: "Ticket Detail" })
  ).toBeVisible();

  await page
    .getByRole("textbox", { name: "Public Comment" })
    .fill(requesterComment);
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(
    page.getByText("Public Comment posted successfully.")
  ).toBeVisible();
  await expect(page.getByText(requesterComment, { exact: true })).toBeVisible();

  await logOut(page);
  await expect(page).toHaveURL(/\/login$/u);
  await logIn(page, staffEmail);
  await page.goto(ticketHref);
  await expect(
    page.getByRole("heading", { name: "Ticket information" })
  ).toBeVisible();
  await expect(page.getByText(requesterComment, { exact: true })).toBeVisible();

  await page
    .getByRole("textbox", { name: "Public Comment" })
    .fill(staffComment);
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(
    page.getByText("Public Comment posted successfully.")
  ).toBeVisible();
  await expect(page.getByText(staffComment, { exact: true })).toBeVisible();

  await logOut(page);
  await expect(page).toHaveURL(/\/login$/u);
  await logIn(page, requesterEmail);
  await page.goto(ticketHref);
  await expect(
    page.getByRole("heading", { name: "Ticket Detail" })
  ).toBeVisible();
  await expect(page.getByText(requesterComment, { exact: true })).toBeVisible();
  await expect(page.getByText(staffComment, { exact: true })).toBeVisible();
});
