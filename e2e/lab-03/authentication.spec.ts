import { writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const password = "correct horse battery staple";
const replacementPassword = "new correct horse phrase";
const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");

const projectSlug = (projectName: string) =>
  projectName.replaceAll(/[^a-z0-9]+/giu, "-").toLowerCase();

const evidencePath = (name: string) =>
  path.resolve(
    repositoryRoot,
    "artifacts",
    "lab-03",
    "screenshots",
    "authentication",
    name
  );

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
  const slug = projectSlug(testInfo.project.name);
  const email = firstLoginEmailBySlug[slug];
  const captured: string[] = [];

  const capture = async (name: string) => {
    const filePath = evidencePath(name);
    await page.screenshot({ fullPage: true, path: filePath });
    captured.push(path.relative(repositoryRoot, filePath));
  };

  if (email === undefined) {
    throw new Error(`No first-login fixture configured for ${slug}.`);
  }

  await page.goto("/");
  await capture(`${slug}-initial.png`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await capture(`${slug}-filled.png`);
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

  await writeFile(
    path.resolve(
      repositoryRoot,
      "artifacts",
      "lab-03",
      "screenshots",
      `manifest-${slug}.json`
    ),
    `${JSON.stringify(
      {
        files: captured,
        generatedAt: new Date().toISOString(),
        project: testInfo.project.name,
      },
      null,
      2
    )}\n`
  );
});
