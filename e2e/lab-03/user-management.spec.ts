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

test("edits account access and resets the initial password", async ({
  page,
}, testInfo) => {
  const slug = projectSlug(testInfo.project.name);
  const uniqueId = `${Date.now()}-${testInfo.workerIndex}`;
  const createdEmail = `e2e-lifecycle-${slug}-${uniqueId}@example.test`;
  const updatedEmail = `e2e-lifecycle-updated-${slug}-${uniqueId}@example.test`;
  const displayNameSuffix = `${slug}-${uniqueId}`;
  const createdDisplayName = `E2E Lifecycle ${displayNameSuffix} Requester`;
  const updatedDisplayName = `E2E Lifecycle ${displayNameSuffix} Staff`;
  const initialPassword = "lifecycle initial account phrase";
  const resetPassword = "lifecycle replacement account phrase";

  const editButton = (displayName: string) =>
    page.locator(`button[aria-label="Edit ${displayName}"]:visible`).first();
  const visibleUser = (displayName: string) =>
    page
      .locator(".user-table-wrap:visible tr, .user-cards:visible .user-card")
      .filter({ hasText: displayName })
      .first();

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/users$/u);

  await page.getByRole("button", { exact: true, name: "Create User" }).click();
  await page.getByLabel(/^Name/u).fill(createdDisplayName);
  await page.getByLabel(/^Email/u).fill(createdEmail);
  await page.locator("#user-role").selectOption("Requester");
  await page.getByLabel(/^Initial password/u).fill(initialPassword);
  await page.getByRole("button", { exact: true, name: "Save User" }).click();
  await expect(
    page.getByText(`${createdDisplayName} was created.`)
  ).toBeVisible();

  await editButton(createdDisplayName).click();
  await expect(
    page.getByRole("heading", { name: `Edit ${createdDisplayName}` })
  ).toBeVisible();
  await page.getByLabel(/^Name/u).fill(updatedDisplayName);
  await page.getByLabel(/^Email/u).fill(updatedEmail);
  await page.locator("#user-role").selectOption("IT Staff");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(
    page.getByText(`${updatedDisplayName} was updated successfully.`)
  ).toBeVisible();

  await editButton(updatedDisplayName).click();
  await expect(
    page.getByRole("checkbox", { name: "Active account" })
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "Active account" }).uncheck();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(
    page.getByText(`${updatedDisplayName} was updated successfully.`)
  ).toBeVisible();
  await expect(visibleUser(updatedDisplayName)).toContainText("Inactive");

  await editButton(updatedDisplayName).click();
  await page.getByRole("checkbox", { name: "Active account" }).check();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(
    page.getByText(`${updatedDisplayName} was updated successfully.`)
  ).toBeVisible();
  await expect(visibleUser(updatedDisplayName)).toContainText("Active");

  await editButton(updatedDisplayName).click();
  await page.getByLabel(/^New initial password/u).fill(resetPassword);
  await page
    .getByRole("checkbox", {
      name: "I understand that all sessions will end.",
    })
    .check();
  await page.getByRole("button", { name: "Reset Initial Password" }).click();
  await expect(
    page.getByText(`${updatedDisplayName}'s initial password was reset.`)
  ).toBeVisible();

  await logOut(page);
  await expect(page).toHaveURL(/\/login$/u);
  await page.getByLabel("Email").fill(updatedEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(resetPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/change-password$/u);
  await expect(
    page.getByRole("heading", { name: "Set your new password" })
  ).toBeVisible();
});
