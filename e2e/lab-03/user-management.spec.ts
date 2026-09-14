import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const adminEmail = "e2e-admin@example.test";
const adminPassword = "correct horse battery staple";
const replacementPassword = "created account replacement phrase";

const projectSlug = (projectName: string) =>
  projectName.replaceAll(/[^a-z0-9]+/giu, "-").toLowerCase();

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

test("creates an active user and completes that user's first login", async ({
  page,
}, testInfo) => {
  const slug = projectSlug(testInfo.project.name);
  const uniqueId = `${Date.now()}-${testInfo.workerIndex}`;
  const createdEmail = `e2e-created-${slug}-${uniqueId}@example.test`;
  const initialPassword = "created account initial phrase";

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/users$/u);
  await expect(
    page.getByRole("heading", { name: "User Management" })
  ).toBeVisible();

  await page.getByRole("button", { exact: true, name: "Create User" }).click();
  await page.getByLabel(/^Name/u).fill("E2E Created Requester");
  await page.getByLabel(/^Email/u).fill(createdEmail);
  await page.locator("#user-role").selectOption("Requester");
  await page.getByLabel(/^Initial password/u).fill(initialPassword);
  await page.getByRole("button", { exact: true, name: "Save User" }).click();

  await expect(
    page.getByRole("status").filter({
      hasText: "The initial password must be replaced at first login",
    })
  ).toBeVisible();
  await expect(page.getByLabel(/^Initial password/u)).toHaveValue("");

  await logOut(page);
  await expect(page).toHaveURL(/\/login$/u);
  await page.getByLabel("Email").fill(createdEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(initialPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/change-password$/u);
  await expect(
    page.getByRole("heading", { name: "Set your new password" })
  ).toBeVisible();
  await page.getByLabel("Current password").fill(initialPassword);
  await page
    .getByRole("textbox", { exact: true, name: "New password" })
    .fill(replacementPassword);
  await page
    .getByRole("textbox", { exact: true, name: "Confirm new password" })
    .fill(replacementPassword);
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/\/tickets$/u);
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
});
