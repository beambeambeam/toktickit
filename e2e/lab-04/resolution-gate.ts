import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const appOrigin = process.env.E2E_BASE_URL ?? "http://localhost:5173";

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

export const readTicketVersion = async (
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
// The session user becomes the Action assignee, so call this as an eligible
// staff user who already owns the Ticket.
export const addCompletedAction = async (
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
