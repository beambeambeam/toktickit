import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { captureLab3Evidence } from "./evidence.js";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const password = "correct horse battery staple";
const origin = "http://localhost:5173";

const requesterEmailByProject: Record<string, string> = {
  "desktop-chromium": "e2e-desktop@example.test",
  "mobile-chromium": "e2e-mobile@example.test",
  "tablet-chromium": "e2e-tablet@example.test",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const signIn = async (page: Page, email: string) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/u);
};

test("keeps Internal Notes private across the staff and requester journey", async ({
  page,
}, testInfo) => {
  const requesterEmail =
    requesterEmailByProject[testInfo.project.name] ??
    "e2e-desktop@example.test";
  const uniqueId = `${Date.now()}-${testInfo.workerIndex}`;
  const summary = `E2E internal note ${uniqueId}`;
  const noteContent = `Private browser note ${uniqueId}`;

  await signIn(page, requesterEmail);
  await expect(page).toHaveURL(/\/tickets$/u);

  const authResponse = await page.request.get(`${apiUrl}/api/auth/me`);
  expect(authResponse.ok()).toBeTruthy();
  const authBody: unknown = await authResponse.json();
  if (!isRecord(authBody) || typeof authBody.csrfToken !== "string") {
    throw new Error("The E2E requester session did not return a CSRF token.");
  }

  const createResponse = await page.request.post(`${apiUrl}/api/tickets`, {
    headers: {
      Origin: origin,
      "X-CSRF-Token": authBody.csrfToken,
    },
    multipart: {
      categoryId: "1",
      description:
        "The private-note browser journey needs a Ticket with enough detail for staff review.",
      relatedSystemId: "1",
      requestedPriority: "Low",
      summary,
    },
  });
  expect(createResponse.status()).toBe(201);
  const createBody: unknown = await createResponse.json();
  if (
    !isRecord(createBody) ||
    !isRecord(createBody.ticket) ||
    typeof createBody.ticket.id !== "number"
  ) {
    throw new Error("The E2E Ticket response did not include an ID.");
  }
  const ticketId = createBody.ticket.id;

  await logOut(page);
  await expect(page).toHaveURL(/\/login$/u);

  await signIn(page, "e2e-staff@example.test");
  await page.goto(`/tickets/${ticketId}`);
  await expect(
    page.getByRole("heading", { name: "Internal Notes" })
  ).toBeVisible();
  await expect(page.getByText("No Internal Notes yet.")).toBeVisible();
  await page.getByRole("textbox", { name: "Internal Note" }).fill(noteContent);
  await page.getByRole("button", { name: "Add Internal Note" }).click();
  await expect(page.getByText(noteContent)).toBeVisible();

  await logOut(page);
  await expect(page).toHaveURL(/\/login$/u);

  await signIn(page, "e2e-admin@example.test");
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByText(noteContent)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Internal Note" })
  ).toHaveCount(0);
  await expect(
    page.getByText("Administrator access is read-only for Internal Notes.")
  ).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-ticket-detail",
    name: "internal-note-admin-read.png",
    role: "Administrator",
    scenario: "Administrator read-only Internal Note",
    stateSource: "natural",
  });

  await logOut(page);
  await expect(page).toHaveURL(/\/login$/u);

  await signIn(page, requesterEmail);
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByText(summary)).toBeVisible();
  await expect(page.getByText(noteContent)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Internal Notes" })
  ).toHaveCount(0);
});
