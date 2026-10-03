/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ActionsApi from "@/api/actions";
import { ApiConnectionError } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import { ActionsTakenSection } from "@/components/actions-taken-section";
import type { CreateActionRequest, Owner } from "@/generated/hey-api/types.gen";

type GetActionsMock = (
  ticketId: number,
  params: { page: number; pageSize: number },
  signal: AbortSignal
) => Promise<unknown>;

type CreateActionMock = (
  ticketId: number,
  input: CreateActionRequest
) => Promise<unknown>;

const { createTicketActionMock, getTicketActionsMock } = vi.hoisted(() => ({
  createTicketActionMock: vi.fn<CreateActionMock>(),
  getTicketActionsMock: vi.fn<GetActionsMock>(),
}));

vi.mock("@/api/actions", async () => {
  const actual = await vi.importActual<typeof ActionsApi>("@/api/actions");

  return {
    ...actual,
    createTicketAction: createTicketActionMock,
    getTicketActions: getTicketActionsMock,
  };
});

vi.mock("@/api/action-query-options", () => ({
  ticketActionsQueryOptions: (
    ticketId: number,
    principalId: number,
    principalRole: string,
    params: { page: number; pageSize: number }
  ) => ({
    queryFn: async ({ signal }: { signal: AbortSignal }) =>
      await getTicketActionsMock(ticketId, params, signal),
    queryKey: [
      "ticket-actions",
      principalId,
      principalRole,
      ticketId,
      params.page,
      params.pageSize,
    ],
    retry: false,
  }),
}));

const owners: Owner[] = [
  {
    displayName: "Iris IT Staff",
    id: 10,
    isActive: true,
    isEligible: true,
    role: "IT Staff",
  },
  {
    displayName: "Ari Administrator",
    id: 20,
    isActive: true,
    isEligible: true,
    role: "Administrator",
  },
];

const action = {
  assignee: {
    displayName: "Iris IT Staff",
    id: 10,
    isActive: true,
    isEligible: true,
    role: "IT Staff" as const,
  },
  attachmentNotes: "Look for <photo>.png",
  cancelledAt: null,
  cancelledBy: null,
  completedAt: null,
  completedBy: null,
  createdAt: "2026-09-30T04:00:00.000Z",
  createdBy: {
    displayName: "Iris IT Staff",
    id: 10,
    role: "IT Staff" as const,
  },
  description: "Replace <the> cable\nthen verify both ports.",
  followUpNote: "Confirm with the requester.",
  followUpRequired: true,
  id: 41,
  performedBy: null,
  result: "<not-html>",
  startedAt: null,
  status: "Planned" as const,
  ticketId: 11,
  updatedAt: "2026-09-30T04:00:00.000Z",
  version: 1,
};

const emptyPage = {
  items: [],
  page: 1,
  pageSize: 20 as const,
  totalItems: 0,
  totalPages: 0,
};

const renderSection = (
  overrides: Partial<Parameters<typeof ActionsTakenSection>[0]> = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ActionsTakenSection
          currentStatus="Open"
          defaultAssigneeId={10}
          onRefreshTicket={vi.fn()}
          owners={owners}
          principalId={10}
          principalRole="IT Staff"
          ticketId={11}
          ticketVersion={7}
          {...overrides}
        />
      </QueryClientProvider>
    ),
  };
};

describe("Actions Taken UI", () => {
  beforeEach(() => {
    getTicketActionsMock.mockReset().mockResolvedValue(emptyPage);
    createTicketActionMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders requester actions as escaped, read-only fields", async () => {
    getTicketActionsMock.mockResolvedValue({
      ...emptyPage,
      items: [action],
      totalItems: 1,
      totalPages: 1,
    });

    const { container } = renderSection({
      owners: [],
      principalRole: "Requester",
    });

    await screen.findByText("Replace <the> cable", { exact: false });
    expect(screen.getByRole("heading", { name: "Actions Taken" })).toBeTruthy();
    expect(
      screen.getAllByText("Iris IT Staff", { exact: false }).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("<not-html>")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add Action Taken" })
    ).toBeNull();
    expect(screen.queryByLabelText("Action Description")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).toContain("&lt;the&gt;");
    expect(container.innerHTML).toContain("&lt;not-html&gt;");
  });

  it("hides creation on Resolved Tickets and shows it for staff on open Tickets", async () => {
    const { unmount } = renderSection();

    await screen.findByRole("button", { name: "Add Action Taken" });
    unmount();

    renderSection({ currentStatus: "Resolved" });
    await screen.findByRole("heading", { name: "Actions Taken" });
    expect(
      screen.queryByRole("button", { name: "Add Action Taken" })
    ).toBeNull();
  });

  it("shows a loading state before the Actions Taken list resolves", async () => {
    let resolvePage: ((value: typeof emptyPage) => void) | undefined;
    // oxlint-disable-next-line promise/avoid-new -- the test controls the in-flight read.
    const pendingPage = new Promise<typeof emptyPage>((resolve) => {
      resolvePage = resolve;
    });
    getTicketActionsMock.mockReturnValueOnce(pendingPage);

    renderSection({ owners: [], principalRole: "Requester" });
    expect(screen.getByText("Loading Actions Taken…")).toBeTruthy();

    resolvePage?.(emptyPage);
    await screen.findByText("No Actions Taken yet.");
  });

  it("renders the exact empty state", async () => {
    renderSection({ owners: [], principalRole: "Requester" });

    expect(await screen.findByText("No Actions Taken yet.")).toBeTruthy();
  });

  it("paginates stable Actions Taken results", async () => {
    const secondAction = { ...action, id: 42 };
    getTicketActionsMock
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [action],
        totalItems: 21,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [secondAction],
        page: 2,
        totalItems: 21,
        totalPages: 2,
      });

    renderSection({ owners: [], principalRole: "Requester" });
    await screen.findByText("Action Taken #41");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(getTicketActionsMock).toHaveBeenCalledWith(
        11,
        { page: 2, pageSize: 20 },
        expect.anything()
      );
    });
    await screen.findByText("Action Taken #42");
    expect(screen.getByText("Page 2 of 2", { exact: false })).toBeTruthy();
  });

  it.each([
    [403, "You do not have permission to read Actions Taken for this Ticket."],
    [404, "This Ticket or its Actions Taken list was not found."],
  ])("renders a safe read error for HTTP %s", async (status, message) => {
    getTicketActionsMock.mockRejectedValueOnce(
      new ApiRequestError(status, "read failure", "READ_FAILURE")
    );

    renderSection({ owners: [], principalRole: "Requester" });
    expect(await screen.findByText(message)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retry Actions Taken" })
    ).toBeTruthy();
  });

  it("offers assignee reload without losing the draft", async () => {
    const retryAssignees = vi.fn().mockResolvedValue(null);
    renderSection({
      onRetryAssignees: retryAssignees,
      ownersError: new Error("Assignees unavailable"),
      principalRole: "Administrator",
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      {
        target: { value: "Keep this while assignees reload" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry assignees" }));
    expect(retryAssignees).toHaveBeenCalledTimes(1);
    expect(
      screen.getByDisplayValue("Keep this while assignees reload")
    ).toBeTruthy();
    expect(createTicketActionMock).not.toHaveBeenCalled();
  });

  it("keeps a saved confirmation without adding off-page actions to paginated cards", async () => {
    getTicketActionsMock.mockResolvedValue({
      ...emptyPage,
      items: [action],
      totalItems: 21,
      totalPages: 2,
    });
    createTicketActionMock.mockResolvedValue({
      action: { ...action, description: "Saved beyond the first page", id: 99 },
      ticket: { id: 11, version: 8 },
    });
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      {
        target: { value: "Saved beyond the first page" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));
    await screen.findByText("Action Taken saved successfully.", {
      exact: false,
    });
    expect(
      screen.getByText("Saved Planned action #99.", { exact: false })
    ).toBeTruthy();
    expect(screen.queryByText("Saved beyond the first page")).toBeNull();
    expect(screen.getByText("Page 1 of 2", { exact: false })).toBeTruthy();
    getTicketActionsMock.mockResolvedValueOnce({
      ...emptyPage,
      items: [{ ...action, description: "Second page action", id: 42 }],
      page: 2,
      totalItems: 21,
      totalPages: 2,
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Second page action");
    expect(screen.queryByText("Saved beyond the first page")).toBeNull();
    expect(screen.queryByText("Action Taken #99")).toBeNull();
  });

  it("rejects an explicitly blank assignee without silently assigning the actor", async () => {
    createTicketActionMock.mockResolvedValue({
      action,
      ticket: { id: 11, version: 8 },
    });
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      { target: { value: "Keep my chosen assignee" } }
    );
    const select = screen.getByLabelText("Assignee", { exact: false });
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));
    await screen.findByText("Choose an eligible assignee.");
    expect(document.activeElement).toBe(select);
    expect(createTicketActionMock).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Keep my chosen assignee")).toBeTruthy();
  });

  it("validates follow-up fields before creating and prevents duplicate submits", async () => {
    let resolveCreate: ((value: unknown) => void) | undefined;
    // oxlint-disable-next-line promise/avoid-new -- the test controls the in-flight write.
    const createPromise = new Promise<unknown>((resolve) => {
      resolveCreate = resolve;
    });
    createTicketActionMock.mockReturnValue(createPromise);

    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );

    const description = screen.getByLabelText("Action Description", {
      exact: false,
    });
    fireEvent.change(description, { target: { value: "Replace the cable" } });
    fireEvent.click(screen.getByLabelText("Follow-Up Required"));
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));

    expect(
      await screen.findByText(
        "Follow-up Note is required when Follow-Up Required is selected."
      )
    ).toBeTruthy();
    expect(createTicketActionMock).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByLabelText("Follow-up Note", { exact: false }),
      {
        target: { value: "Confirm with the requester" },
      }
    );
    fireEvent.click(screen.getByLabelText("Follow-Up Required"));
    fireEvent.click(screen.getByLabelText("Follow-Up Required"));
    expect(
      screen.getByLabelText("Follow-up Note", { exact: false })
    ).toHaveProperty("value", "");
    fireEvent.change(
      screen.getByLabelText("Follow-up Note", { exact: false }),
      {
        target: { value: "Confirm with the requester" },
      }
    );
    const submit = screen.getByRole("button", {
      name: "Save Action Taken",
    });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => {
      expect(createTicketActionMock).toHaveBeenCalledTimes(1);
    });
    expect(createTicketActionMock).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        assigneeId: 10,
        description: "Replace the cable",
        followUpNote: "Confirm with the requester",
        followUpRequired: true,
        version: 7,
      })
    );
    expect(createTicketActionMock.mock.calls[0]?.[1].requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    );

    resolveCreate?.({ action, ticket: { id: 11, version: 8 } });
    await screen.findByText("Action Taken saved successfully.", {
      exact: false,
    });
  });

  it("focuses Action Description when Save is pressed with a blank form", async () => {
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );

    const description = screen.getByLabelText("Action Description", {
      exact: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));

    await screen.findByText(/Action Description must contain/u);
    expect(document.activeElement).toBe(description);
    expect(createTicketActionMock).not.toHaveBeenCalled();
  });

  it("retains the draft after an uncertain failure", async () => {
    createTicketActionMock.mockRejectedValue(
      new ApiConnectionError(new Error("offline"))
    );

    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      {
        target: { value: "Retain this draft after transport failure" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));

    const uncertainMessages = await screen.findAllByText(
      /request may have succeeded/u
    );
    expect(uncertainMessages.length).toBeGreaterThan(0);
    expect(
      screen.getByDisplayValue("Retain this draft after transport failure")
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retry original action" })
    ).toBeTruthy();
  });

  it("retains the original request identity across a recoverable API failure and retry", async () => {
    createTicketActionMock
      .mockRejectedValueOnce(
        new ApiRequestError(500, "temporary failure", "INTERNAL_ERROR")
      )
      .mockResolvedValueOnce({ action, ticket: { id: 11, version: 8 } });

    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      { target: { value: "Retry this original action" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));
    await screen.findByRole("button", { name: "Retry original action" });

    const firstRequestId = createTicketActionMock.mock.calls[0]?.[1].requestId;
    fireEvent.click(
      screen.getByRole("button", { name: "Retry original action" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));

    await waitFor(() => {
      expect(createTicketActionMock).toHaveBeenCalledTimes(2);
    });
    expect(createTicketActionMock.mock.calls[1]?.[0]).toBe(11);
    expect(createTicketActionMock.mock.calls[1]?.[1]).toMatchObject({
      description: "Retry this original action",
      requestId: firstRequestId,
      version: 7,
    });
  });

  it("keeps an uncertain replay form available when the Ticket becomes terminal", async () => {
    createTicketActionMock.mockRejectedValue(
      new ApiRequestError(500, "temporary failure", "INTERNAL_ERROR")
    );

    const rendered = renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      { target: { value: "Keep this replayable" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));
    await screen.findByRole("button", { name: "Retry original action" });

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ActionsTakenSection
          currentStatus="Closed"
          defaultAssigneeId={10}
          onRefreshTicket={vi.fn()}
          owners={owners}
          principalId={10}
          principalRole="IT Staff"
          ticketId={11}
          ticketVersion={8}
        />
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("button", { name: "Retry original action" })
    ).toBeTruthy();
    expect(screen.getByDisplayValue("Keep this replayable")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add Action Taken" })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Save Action Taken" })
    ).toHaveProperty("disabled", false);
  });

  it("preserves the draft and offers latest Ticket refresh on a version conflict", async () => {
    const refreshTicket = vi.fn().mockResolvedValue(null);
    createTicketActionMock.mockRejectedValueOnce(
      new ApiRequestError(409, "Ticket version is stale.", "VERSION_CONFLICT")
    );

    renderSection({ onRefreshTicket: refreshTicket });
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      { target: { value: "Keep this after conflict" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));

    await screen.findByText(
      /Ticket changed while the action was being created/u
    );
    expect(screen.getByDisplayValue("Keep this after conflict")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh latest Ticket" })
    );
    expect(refreshTicket).toHaveBeenCalledTimes(1);
  });

  it("ignores a late create result after the Ticket identity changes", async () => {
    let resolveCreate: ((value: unknown) => void) | undefined;
    // oxlint-disable-next-line promise/avoid-new -- the test controls a write across a Ticket switch.
    const pending = new Promise<unknown>((resolve) => {
      resolveCreate = resolve;
    });
    createTicketActionMock.mockReturnValue(pending);
    const rendered = renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      {
        target: { value: "Old Ticket secret action" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));
    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ActionsTakenSection
          currentStatus="Open"
          defaultAssigneeId={10}
          onRefreshTicket={vi.fn()}
          owners={owners}
          principalId={10}
          principalRole="IT Staff"
          ticketId={12}
          ticketVersion={3}
        />
      </QueryClientProvider>
    );
    const add = await screen.findByRole("button", { name: "Add Action Taken" });
    expect(add).toHaveProperty("disabled", false);
    fireEvent.click(add);
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      {
        target: { value: "New Ticket draft" },
      }
    );
    await act(async () => {
      resolveCreate?.({
        action: { ...action, description: "Old Ticket secret action" },
        ticket: { id: 11, version: 8 },
      });
      await pending;
    });
    expect(screen.queryByText("Old Ticket secret action")).toBeNull();
    expect(screen.getByDisplayValue("New Ticket draft")).toBeTruthy();
    expect(screen.queryByText(/saved successfully/u)).toBeNull();
  });

  it("resets draft and request identity when principal or Ticket changes", async () => {
    createTicketActionMock.mockRejectedValue(
      new ApiRequestError(500, "temporary failure", "INTERNAL_ERROR")
    );

    const rendered = renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      { target: { value: "First principal draft" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));
    await screen.findByRole("button", { name: "Retry original action" });
    const firstRequestId = createTicketActionMock.mock.calls[0]?.[1].requestId;

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ActionsTakenSection
          currentStatus="Open"
          defaultAssigneeId={20}
          onRefreshTicket={vi.fn()}
          owners={owners}
          principalId={20}
          principalRole="Administrator"
          ticketId={12}
          ticketVersion={3}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Retry original action" })
      ).toBeNull();
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Action Taken" })
    );
    expect(screen.getByLabelText("Assignee", { exact: false })).toHaveProperty(
      "value",
      "20"
    );
    fireEvent.change(
      screen.getByLabelText("Action Description", { exact: false }),
      { target: { value: "Second principal draft" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Action Taken" }));

    await waitFor(() => {
      expect(createTicketActionMock).toHaveBeenCalledTimes(2);
    });
    expect(createTicketActionMock.mock.calls[1]?.[0]).toBe(12);
    const secondInput = createTicketActionMock.mock.calls[1]?.[1];
    expect(secondInput).toMatchObject({
      assigneeId: 20,
      description: "Second principal draft",
      version: 3,
    });
    expect(secondInput?.requestId).not.toBe(firstRequestId);
  });
});
