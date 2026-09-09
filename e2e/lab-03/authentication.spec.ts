import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const password = "correct horse battery staple";
const replacementPassword = "new correct horse phrase";

const firstLoginEmailBySlug: Record<string, string> = {
  "desktop-chromium": "e2e-first-login-desktop@example.test",
  "mobile-chromium": "e2e-first-login-mobile@example.test",
  "tablet-chromium": "e2e-first-login-tablet@example.test",
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

const getSessionCookie = async (page: Page): Promise<string> => {
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === "toktickit_session");

  if (session === undefined) {
    throw new Error("First login did not create a session cookie.");
  }

  return session.value;
};

test("changes an initial password and rejects the old session after logout", async ({
  page,
  request,
}, testInfo) => {
  const slug = testInfo.project.name
    .replaceAll(/[^a-z0-9]+/giu, "-")
    .toLowerCase();
  const email = firstLoginEmailBySlug[slug];

  if (email === undefined) {
    throw new Error(`No first-login fixture configured for ${slug}.`);
  }

  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/change-password$/u);
  await expect(
    page.getByRole("heading", { name: "Set your new password" })
  ).toBeVisible();
  const session = await getSessionCookie(page);

  await page.getByLabel("Current password").fill(password);
  await page
    .getByRole("textbox", { exact: true, name: "New password" })
    .fill(replacementPassword);
  await page
    .getByRole("textbox", { exact: true, name: "Confirm new password" })
    .fill(replacementPassword);
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/\/tickets$/u);
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  const newSession = await getSessionCookie(page);

  const replay = await request.get(`${apiUrl}/api/auth/me`, {
    headers: { Cookie: `toktickit_session=${session}` },
  });
  expect(replay.status()).toBe(401);

  await logOut(page);
  await expect(page).toHaveURL(/\/login$/u);
  const loggedOutReplay = await request.get(`${apiUrl}/api/auth/me`, {
    headers: { Cookie: `toktickit_session=${newSession}` },
  });
  expect(loggedOutReplay.status()).toBe(401);
  await page.goto("/tickets");
  await expect(
    page.getByRole("heading", { name: "Sign in to TokTickIT" })
  ).toBeVisible();
});
