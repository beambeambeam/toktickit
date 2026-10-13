import { randomUUID } from "node:crypto";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const appOrigin = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const password = "correct horse battery staple";
const requesterEmail = "e2e-desktop@example.test";
const staffEmail = "e2e-staff@example.test";

type JsonObject = Record<string, unknown>;

interface ActionRef {
  id: number;
  version: number;
}

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown, label: string): JsonObject => {
  if (!isRecord(value)) {
    throw new TypeError(`Expected ${label} to be an object.`);
  }
  return value;
};

const signIn = async (page: Page, email: string): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/u);
};

const logOut = async (page: Page): Promise<void> => {
  const mobileNavigation = page.locator(".mobile-nav");
  if (await mobileNavigation.isVisible()) {
    await mobileNavigation.locator("summary").click();
    await mobileNavigation.getByRole("button", { name: "Log out" }).click();
  } else {
    await page
      .locator(".account-chip")
      .getByRole("button", { name: "Log out" })
      .click();
  }
  await expect(page).toHaveURL(/\/login$/u);
};

const readSession = async (
  page: Page
): Promise<{ csrfToken: string; userId: number }> => {
  const response = await page.request.get(`${apiUrl}/api/auth/me`);
  expect(response.status()).toBe(200);
  const body = asRecord(await response.json(), "session response");
  const user = asRecord(body.user, "session user");
  if (typeof body.csrfToken !== "string" || typeof user.id !== "number") {
    throw new TypeError("Expected a CSRF token and user ID.");
  }
  return { csrfToken: body.csrfToken, userId: user.id };
};

const apiGet = async (page: Page, path: string): Promise<JsonObject> => {
  const response = await page.request.get(`${apiUrl}${path}`);
  expect(response.status(), await response.text()).toBe(200);
  return asRecord(await response.json(), `GET ${path}`);
};

const apiPost = async (
  page: Page,
  path: string,
  data: JsonObject,
  expectedStatus = 200
): Promise<JsonObject> => {
  const { csrfToken } = await readSession(page);
  const response = await page.request.post(`${apiUrl}${path}`, {
    data,
    headers: { Origin: appOrigin, "X-CSRF-Token": csrfToken },
  });
  expect(response.status(), await response.text()).toBe(expectedStatus);
  return asRecord(await response.json(), `POST ${path}`);
};

const ticketVersion = async (page: Page, ticketId: number): Promise<number> => {
  const ticket = await apiGet(page, `/api/tickets/${ticketId}`);
  if (typeof ticket.version !== "number") {
    throw new TypeError("Expected a Ticket version.");
  }
  return ticket.version;
};

const createTicket = async (page: Page): Promise<number> => {
  const { csrfToken } = await readSession(page);
  const response = await page.request.post(`${apiUrl}/api/tickets`, {
    headers: { Origin: appOrigin, "X-CSRF-Token": csrfToken },
    multipart: {
      categoryId: "1",
      description: "Ticket for the resolution gate browser flow.",
      relatedSystemId: "1",
      requestedPriority: "Low",
      summary: `E2E ticket resolution ${Date.now()}`,
    },
  });
  expect(response.status()).toBe(201);
  const ticket = asRecord(
    asRecord(await response.json(), "Ticket response").ticket,
    "created Ticket"
  );
  if (typeof ticket.id !== "number") {
    throw new TypeError("Expected a Ticket ID.");
  }
  return ticket.id;
};

const claimTicket = async (page: Page, ticketId: number): Promise<void> => {
  await apiPost(page, `/api/tickets/${ticketId}/claim`, {
    version: await ticketVersion(page, ticketId),
  });
};

const setStatusByApi = async (
  page: Page,
  ticketId: number,
  currentStatus: string
): Promise<void> => {
  await apiPost(page, `/api/tickets/${ticketId}/status`, {
    currentStatus,
    version: await ticketVersion(page, ticketId),
  });
};

const createAction = async (
  page: Page,
  ticketId: number,
  input: { assigneeId: number; description: string; result: string | null }
): Promise<ActionRef> => {
  const body = await apiPost(
    page,
    `/api/tickets/${ticketId}/actions`,
    {
      assigneeId: input.assigneeId,
      description: input.description,
      followUpRequired: false,
      requestId: randomUUID(),
      result: input.result,
      version: await ticketVersion(page, ticketId),
    },
    201
  );
  const action = asRecord(body.action, "Action Taken");
  if (typeof action.id !== "number" || typeof action.version !== "number") {
    throw new TypeError("Expected an Action Taken ID and version.");
  }
  return { id: action.id, version: action.version };
};

const transitionAction = async (
  page: Page,
  ticketId: number,
  action: ActionRef,
  toStatus: "In Progress" | "Completed" | "Cancelled",
  confirmed: boolean
): Promise<ActionRef> => {
  const body = await apiPost(
    page,
    `/api/tickets/${ticketId}/actions/${action.id}/transition`,
    {
      actionVersion: action.version,
      ticketVersion: await ticketVersion(page, ticketId),
      toStatus,
      ...(confirmed ? { confirmed: true } : {}),
    }
  );
  const updated = asRecord(body.action, "transitioned Action Taken");
  if (typeof updated.id !== "number" || typeof updated.version !== "number") {
    throw new TypeError("Expected an Action Taken ID and version.");
  }
  return { id: updated.id, version: updated.version };
};

const requestStatusChange = async (
  page: Page,
  status: string
): Promise<void> => {
  await page.getByLabel("Next status").selectOption(status);
  await page.getByRole("button", { name: "Apply Status" }).click();
};

const confirmStatusChange = async (
  page: Page,
  status: string
): Promise<void> => {
  await requestStatusChange(page, status);
  await page
    .getByRole("alertdialog", { name: `Mark Ticket ${status}?` })
    .getByRole("button", { name: `Confirm ${status}` })
    .click();
};

const checkLayoutAndAccessibility = async (page: Page): Promise<void> => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
};

test("resolution is gated, indicated, resolved, and reopened", async ({
  page,
}) => {
  await signIn(page, requesterEmail);
  const ticketId = await createTicket(page);
  await logOut(page);

  await signIn(page, staffEmail);
  const { userId: staffId } = await readSession(page);
  await claimTicket(page, ticketId);
  await setStatusByApi(page, ticketId, "Open");
  await setStatusByApi(page, ticketId, "In Progress");
  const planned = await createAction(page, ticketId, {
    assigneeId: staffId,
    description: "Restart the print spooler.",
    result: "Spooler restarted.",
  });
  const inProgress = await transitionAction(
    page,
    ticketId,
    planned,
    "In Progress",
    false
  );
  await logOut(page);

  await signIn(page, requesterEmail);
  await page.goto(`/tickets/${ticketId}`);
  await page.getByRole("button", { name: "Problem Appears Resolved" }).click();
  await expect(
    page.getByText(
      "Your apparent-resolution indication was recorded for Staff."
    )
  ).toBeVisible();
  await logOut(page);

  await signIn(page, staffEmail);
  await page.goto(`/tickets/${ticketId}`);
  await confirmStatusChange(page, "Resolved");
  const reasons = page.getByRole("list", {
    name: "Resolution requirements not met",
  });
  await expect(reasons.getByRole("listitem")).toHaveCount(2);
  await expect(reasons).toContainText(
    "Complete or cancel every Planned and In Progress Action Taken."
  );
  await expect(reasons).toContainText(
    "Record at least one Completed Action Taken."
  );
  await expect(page.getByText("Current status: In Progress")).toBeVisible();
  await checkLayoutAndAccessibility(page);

  await apiPost(
    page,
    `/api/tickets/${ticketId}/actions/${inProgress.id}/transition`,
    {
      actionVersion: inProgress.version,
      confirmed: true,
      ticketVersion: await ticketVersion(page, ticketId),
      toStatus: "Completed",
    }
  );
  await page.reload();
  await confirmStatusChange(page, "Resolved");
  await expect(
    page.getByText("Ticket status changed to Resolved.")
  ).toBeVisible();

  const history = page.getByRole("region", { name: "Status history" });
  await expect(
    history
      .getByRole("listitem")
      .filter({ hasText: /In Progress\s*→\s*Resolved/u })
  ).toHaveCount(1);

  await requestStatusChange(page, "Reopened");
  await expect(
    page.getByText("Ticket status changed to Reopened.")
  ).toBeVisible();
  await expect(
    history
      .getByRole("listitem")
      .filter({ hasText: /Resolved\s*→\s*Reopened/u })
  ).toHaveCount(1);
  await logOut(page);

  await signIn(page, requesterEmail);
  await page.goto(`/tickets/${ticketId}`);
  await expect(
    page.getByRole("button", { name: "Problem Appears Resolved" })
  ).toBeVisible();
  await logOut(page);
});

test("cancellation waits for pending Action Taken", async ({ page }) => {
  await signIn(page, requesterEmail);
  const ticketId = await createTicket(page);
  await logOut(page);

  await signIn(page, staffEmail);
  const { userId: staffId } = await readSession(page);
  await claimTicket(page, ticketId);
  await setStatusByApi(page, ticketId, "Open");
  await setStatusByApi(page, ticketId, "In Progress");
  const planned = await createAction(page, ticketId, {
    assigneeId: staffId,
    description: "Replace the toner cartridge.",
    result: null,
  });

  await page.goto(`/tickets/${ticketId}`);
  await confirmStatusChange(page, "Cancelled");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Finish or cancel every Planned and In Progress" })
  ).toBeVisible();
  await expect(page.getByText("Current status: In Progress")).toBeVisible();

  await transitionAction(page, ticketId, planned, "Cancelled", true);
  await page.reload();
  await confirmStatusChange(page, "Cancelled");
  await expect(
    page.getByText("Ticket status changed to Cancelled.")
  ).toBeVisible();
  await expect(
    page.getByText("This Ticket has no available next status.")
  ).toBeVisible();
  await logOut(page);
});
