/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { createTicketAction, getTicketActions } from "@/api/actions";
import { clearCsrfToken, setCsrfToken } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import type { TicketDetail } from "@/generated/hey-api/types.gen";

const { createApiTicketActionMock, getApiTicketActionsMock } = vi.hoisted(
  () => ({
    createApiTicketActionMock: vi.fn(),
    getApiTicketActionsMock: vi.fn(),
  })
);

vi.mock("@/generated/hey-api/sdk.gen", () => ({
  createApiTicketAction: createApiTicketActionMock,
  getApiTicketActions: getApiTicketActionsMock,
}));

const userRef = {
  displayName: "Iris IT Staff",
  id: 10,
  role: "IT Staff" as const,
};

const action = {
  assignee: {
    ...userRef,
    isActive: true,
    isEligible: true,
  },
  attachmentNotes: null,
  cancelledAt: null,
  cancelledBy: null,
  completedAt: null,
  completedBy: null,
  createdAt: "2026-09-30T04:00:00.000Z",
  createdBy: userRef,
  description: "Replace the damaged network cable.",
  followUpNote: null,
  followUpRequired: false,
  id: 41,
  performedBy: null,
  result: null,
  startedAt: null,
  status: "Planned" as const,
  ticketId: 120,
  updatedAt: "2026-09-30T04:00:00.000Z",
  version: 1,
};

const actionPage = {
  items: [action],
  page: 2,
  pageSize: 10 as const,
  totalItems: 11,
  totalPages: 2,
};

const ticket: TicketDetail = {
  attachments: [],
  cancelledAt: null,
  category: { id: 1, name: "Network" },
  closedAt: null,
  currentStatus: "Open",
  description: "The office network is unavailable.",
  id: 120,
  itPriority: "Medium",
  owner: null,
  relatedSystem: { id: 2, name: "Office network" },
  reopenedAt: null,
  requestedPriority: "Medium",
  requester: {
    displayName: "Rina Requester",
    email: "rina@example.com",
    id: 12,
  },
  resolutionIndication: null,
  resolvedAt: null,
  statusChangedAt: "2026-09-30T04:00:00.000Z",
  summary: "Office network unavailable",
  ticketDate: "2026-09-30T04:00:00.000Z",
  ticketNumber: "TK-00120",
  updatedAt: "2026-09-30T04:00:00.000Z",
  version: 8,
};

describe("Actions Taken API adapter", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  it("lists a stable page with the requested page and page size", async () => {
    getApiTicketActionsMock.mockResolvedValue({
      data: actionPage,
      response: Response.json(actionPage),
    });

    await expect(
      getTicketActions(120, { page: 2, pageSize: 10 })
    ).resolves.toEqual(actionPage);
    expect(getApiTicketActionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { ticketId: 120 },
        query: { page: 2, pageSize: 10 },
      })
    );
  });

  it("creates with the current Ticket version and CSRF token", async () => {
    setCsrfToken("csrf-token");
    const mutation = { action, ticket };
    createApiTicketActionMock.mockResolvedValue({
      data: mutation,
      response: Response.json(mutation),
    });

    await expect(
      createTicketAction(120, {
        assigneeId: 12,
        attachmentNotes: "See the photo.",
        description: "Replace the damaged network cable.",
        followUpNote: null,
        followUpRequired: false,
        requestId: "a5726990-c560-45d5-ae76-2f75659bb540",
        result: null,
        version: 7,
      })
    ).resolves.toEqual(mutation);

    expect(createApiTicketActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          assigneeId: 12,
          attachmentNotes: "See the photo.",
          description: "Replace the damaged network cable.",
          followUpRequired: false,
          requestId: "a5726990-c560-45d5-ae76-2f75659bb540",
          version: 7,
        },
        headers: { "X-CSRF-Token": "csrf-token" },
        path: { ticketId: 120 },
      })
    );
  });

  it("rejects a mutation ticket that only has cache identity fields", async () => {
    setCsrfToken("csrf-token");
    const mutation = { action, ticket: { id: 120, version: 8 } };
    createApiTicketActionMock.mockResolvedValue({
      data: mutation,
      response: Response.json(mutation),
    });

    await expect(
      createTicketAction(120, {
        description: "Replace the damaged network cable.",
        followUpRequired: false,
        requestId: "a5726990-c560-45d5-ae76-2f75659bb540",
        version: 7,
      })
    ).rejects.toMatchObject({
      constructor: ApiRequestError,
      message: "The API returned an invalid Actions Taken mutation response.",
      status: 500,
    });
  });

  it("rejects a mutation ticket with malformed nested detail data", async () => {
    setCsrfToken("csrf-token");
    const mutation = {
      action,
      ticket: { ...ticket, requester: { ...ticket.requester, email: 42 } },
    };
    createApiTicketActionMock.mockResolvedValue({
      data: mutation,
      response: Response.json(mutation),
    });

    await expect(
      createTicketAction(120, {
        description: "Replace the damaged network cable.",
        followUpRequired: false,
        requestId: "a5726990-c560-45d5-ae76-2f75659bb540",
        version: 7,
      })
    ).rejects.toMatchObject({
      constructor: ApiRequestError,
      message: "The API returned an invalid Actions Taken mutation response.",
      status: 500,
    });
  });

  it("rejects an invalid action page with a safe API error", async () => {
    getApiTicketActionsMock.mockResolvedValue({
      data: { items: [{ id: "not-an-id" }] },
      response: Response.json({ items: [{ id: "not-an-id" }] }),
    });

    await expect(getTicketActions(120)).rejects.toMatchObject({
      constructor: ApiRequestError,
      message: "The API returned an invalid Actions Taken response.",
      status: 500,
    });
  });
});
