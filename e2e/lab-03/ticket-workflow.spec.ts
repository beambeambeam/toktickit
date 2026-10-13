import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { captureLab3Evidence } from "./evidence.js";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const appOrigin = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const staffEmail = "e2e-staff@example.test";
const staffPassword = "correct horse battery staple";
const workflowTicketNumber = "TKT-20260901-RES001";

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

const readTicketVersion = async (
  page: Page,
  ticketId: number
): Promise<number> => {
  const response = await page.request.get(`${apiUrl}/api/tickets/${ticketId}`);
  expect(response.status()).toBe(200);
  const ticket = asRecord(await response.json(), "Ticket response");
  if (typeof ticket.version !== "number") {
    throw new TypeError("Expected a Ticket version.");
  }
  return ticket.version;
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

// Resolved requires an owner and a Completed Action Taken (Lab 4 gate).
// RES001 keeps its seeded owner, so only the Completed action is added here.
const addCompletedAction = async (
  page: Page,
  ticketId: number
): Promise<void> => {
  const { csrfToken, userId } = await readSession(page);
  const post = async (
    path: string,
    data: JsonObject,
    expectedStatus: number
  ): Promise<ActionRef> => {
    const response = await page.request.post(`${apiUrl}${path}`, {
      data,
      headers: { Origin: appOrigin, "X-CSRF-Token": csrfToken },
    });
    expect(response.status(), await response.text()).toBe(expectedStatus);
    const body = asRecord(await response.json(), `POST ${path}`);
    const action = asRecord(body.action, "Action response");
    if (typeof action.id !== "number" || typeof action.version !== "number") {
      throw new TypeError("Expected an Action ID and version.");
    }
    return { id: action.id, version: action.version };
  };
  const transitionPath = (action: ActionRef): string =>
    `/api/tickets/${ticketId}/actions/${action.id}/transition`;

  const created = await post(
    `/api/tickets/${ticketId}/actions`,
    {
      assigneeId: userId,
      description: "Completed action for the resolution gate.",
      followUpRequired: false,
      requestId: randomUUID(),
      result: "Resolved for the Ticket workflow test.",
      version: await readTicketVersion(page, ticketId),
    },
    201
  );
  const started = await post(
    transitionPath(created),
    {
      actionVersion: created.version,
      ticketVersion: await readTicketVersion(page, ticketId),
      toStatus: "In Progress",
    },
    200
  );
  await post(
    transitionPath(started),
    {
      actionVersion: started.version,
      confirmed: true,
      ticketVersion: await readTicketVersion(page, ticketId),
      toStatus: "Completed",
    },
    200
  );
};

test("progresses and reopens a Ticket through the staff workflow", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(staffPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/staff\/tickets$/u);
  await page
    .getByRole("searchbox", { exact: true, name: "Search" })
    .fill(workflowTicketNumber);
  await page.getByRole("button", { exact: true, name: "Search" }).click();
  const queue = page.locator(
    ".ticket-table-wrap:visible, .ticket-cards:visible"
  );
  const ticket = queue
    .locator("tr, .ticket-card")
    .filter({ hasText: workflowTicketNumber })
    .first();
  await ticket.getByRole("link", { name: workflowTicketNumber }).click();
  await expect(
    page.getByRole("heading", { name: "Progress Ticket" })
  ).toBeVisible();

  const statusSelect = page.getByLabel("Next status");
  const statusLine = page.locator(".required-note").filter({
    hasText: "Current status:",
  });
  const currentStatus = async () => {
    const text = await statusLine.textContent();
    const status = text?.match(/Current status: (?<status>[^·]+)/u)?.groups
      ?.status;
    if (status === undefined) {
      throw new Error(`Unable to read current Ticket status from ${text}`);
    }

    return status.trim();
  };

  const applyStatus = async (status: string) => {
    await statusSelect.selectOption(status);
    await page.getByRole("button", { name: "Apply Status" }).click();

    if (["Resolved", "Closed", "Cancelled"].includes(status)) {
      const dialog = page.getByRole("alertdialog");
      await dialog.getByRole("button", { name: `Confirm ${status}` }).click();
    }

    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `Ticket status changed to ${status}.` })
    ).toBeVisible();
  };

  let status = await currentStatus();
  if (status === "Resolved") {
    await applyStatus("Reopened");
    status = "Reopened";
  }
  if (status === "New") {
    await applyStatus("Open");
    status = "Open";
  }
  if (status === "Reopened" || status === "Waiting for Requester") {
    await applyStatus("In Progress");
    status = "In Progress";
  }
  if (status === "Open") {
    await applyStatus("In Progress");
    status = "In Progress";
  }

  expect(status).toBe("In Progress");
  const ticketId = Number(new URL(page.url()).pathname.split("/").at(-1));
  await addCompletedAction(page, ticketId);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Progress Ticket" })
  ).toBeVisible();
  await expect(statusLine).toContainText("Current status: In Progress");

  await statusSelect.selectOption("Resolved");
  await page.getByRole("button", { name: "Apply Status" }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  const cancel = confirmation.getByRole("button", { name: "Cancel" });
  const confirmResolved = confirmation.getByRole("button", {
    name: "Confirm Resolved",
  });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirmResolved).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await captureLab3Evidence(page, testInfo, {
    directory: "accessibility",
    name: "status-confirmation-keyboard.png",
    role: "IT Staff",
    scenario: "Status confirmation focus trap",
    stateSource: "natural",
  });
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Apply Status" })
  ).toBeFocused();

  await statusSelect.selectOption("Resolved");
  await applyStatus("Resolved");
  await expect(statusLine).toContainText("Current status: Resolved");
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-ticket-detail",
    name: "workflow-resolved.png",
    role: "IT Staff",
    scenario: "Resolved staff workflow",
    stateSource: "natural",
  });
});
