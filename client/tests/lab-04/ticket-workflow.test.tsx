/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as TanStackRouter from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/api/auth";
import { ApiRequestError } from "@/api/errors";
import type { Owner } from "@/generated/hey-api/types.gen";
import { StaffTicketDetailPage } from "@/pages/staff-ticket-detail-page";

const {
  authState,
  claimStaffTicketMock,
  downloadTicketAttachmentMock,
  getInternalNotesMock,
  postInternalNoteMock,
  getStaffOwnersMock,
  getTicketCommentsMock,
  getTicketMock,
  getTicketStatusHistoryMock,
  postTicketCommentMock,
  refetchAuthMock,
  updateStaffTicketItPriorityMock,
  updateStaffTicketOwnerMock,
  updateStaffTicketStatusMock,
} = vi.hoisted(() => ({
  authState: { user: null as AuthUser | null },
  claimStaffTicketMock: vi.fn(),
  downloadTicketAttachmentMock: vi.fn(),
  getInternalNotesMock: vi.fn(),
  getStaffOwnersMock: vi.fn<() => Promise<Owner[]>>(),
  getTicketCommentsMock: vi.fn(),
  getTicketMock: vi.fn(),
  getTicketStatusHistoryMock: vi.fn(),
  postInternalNoteMock: vi.fn(),
  postTicketCommentMock: vi.fn(),
  refetchAuthMock: vi.fn(),
  updateStaffTicketItPriorityMock: vi.fn(),
  updateStaffTicketOwnerMock: vi.fn(),
  updateStaffTicketStatusMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof TanStackRouter>(
    "@tanstack/react-router"
  );

  return {
    ...actual,
    Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/api/query-options", () => ({
  internalNotesQueryOptions: (ticketId: number, principalId: number) => ({
    queryFn: async () => {
      const result: unknown = await getInternalNotesMock(ticketId);
      return result;
    },
    queryKey: ["internal-notes", principalId, ticketId],
    retry: false,
  }),
  ticketCommentsQueryOptions: (ticketId: number, principalId: number) => ({
    queryFn: async () => {
      const result: unknown = await getTicketCommentsMock(ticketId);
      return result;
    },
    queryKey: ["ticket-comments", principalId, ticketId],
    retry: false,
  }),
  ticketQueryOptions: (ticketId: number, principalId: number) => ({
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const result: unknown = await getTicketMock(ticketId, signal);
      return result;
    },
    queryKey: ["ticket", principalId, ticketId],
    retry: false,
  }),
}));

vi.mock("@/api/requester", () => ({
  downloadTicketAttachment: downloadTicketAttachmentMock,
}));

vi.mock("@/api/internal-notes", () => ({
  getTicketInternalNotes: getInternalNotesMock,
  postTicketInternalNote: postInternalNoteMock,
}));

vi.mock("@/api/ticket-comments", () => ({
  getTicketComments: getTicketCommentsMock,
  postTicketComment: postTicketCommentMock,
}));

vi.mock("@/api/staff", () => ({
  claimStaffTicket: claimStaffTicketMock,
  getTicketStatusHistory: getTicketStatusHistoryMock,
  updateStaffTicketItPriority: updateStaffTicketItPriorityMock,
  updateStaffTicketOwner: updateStaffTicketOwnerMock,
  updateStaffTicketStatus: updateStaffTicketStatusMock,
}));

vi.mock("@/api/staff-query-options", () => ({
  staffOwnersQueryOptions: () => ({
    queryFn: async () => await getStaffOwnersMock(),
    queryKey: ["staff-owners"],
    retry: false,
  }),
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    auth:
      authState.user === null
        ? null
        : { csrfToken: "csrf", user: authState.user },
    authError: null,
    changePassword: vi.fn(),
    isLoading: false,
    isRefreshing: false,
    login: vi.fn(),
    logout: vi.fn(),
    refetchAuth: refetchAuthMock,
    user: authState.user,
  }),
}));

const staffUser: AuthUser = {
  createdAt: "2026-09-01T00:00:00.000Z",
  displayName: "Iris IT Staff",
  email: "staff@example.test",
  id: 10,
  isActive: true,
  mustChangePassword: false,
  role: "IT Staff",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const administratorUser: AuthUser = {
  ...staffUser,
  displayName: "Avery Administrator",
  email: "admin@example.test",
  id: 20,
  role: "Administrator",
};

const ticket = {
  attachments: [],
  cancelledAt: null,
  category: { id: 1, name: "Network" },
  closedAt: null,
  currentStatus: "In Progress" as const,
  description: "The campus network is unavailable from the third floor.",
  id: 11,
  itPriority: "High" as const,
  owner: {
    displayName: "Iris IT Staff",
    id: 10,
    isActive: true,
    isEligible: true,
    role: "IT Staff" as const,
  },
  relatedSystem: { id: 2, name: "Campus Wi-Fi" },
  reopenedAt: null,
  requestedPriority: "Medium" as const,
  requester: {
    displayName: "Ada Requester",
    email: "ada@example.test",
    id: 1,
  },
  resolutionIndication: null,
  resolvedAt: null,
  statusChangedAt: "2026-09-02T10:30:00.000Z",
  summary: "Campus Wi-Fi outage",
  ticketDate: "2026-09-02T10:00:00.000Z",
  ticketNumber: "TKT-20260902-DETAIL01",
  updatedAt: "2026-09-02T11:00:00.000Z",
  version: 2,
};

const historyEvent = (index: number) => ({
  actor: { displayName: "Iris IT Staff", id: 10, role: "IT Staff" },
  confirmed: false,
  createdAt: "2026-09-02T10:45:00.000Z",
  fromStatus: index % 2 === 0 ? "Waiting for Requester" : "In Progress",
  id: index,
  ticketId: 11,
  ticketVersion: index + 1,
  toStatus: index % 2 === 0 ? "In Progress" : "Waiting for Requester",
});

const renderPage = (ticketId = "11") => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <StaffTicketDetailPage ticketId={ticketId} />
      </QueryClientProvider>
    ),
  };
};

const requestResolved = async () => {
  fireEvent.change(screen.getByLabelText("Next status"), {
    target: { value: "Resolved" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply Status" }));

  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Confirm Resolved" })
  );
};

describe("Lab 4 Ticket workflow controls", () => {
  beforeEach(() => {
    authState.user = staffUser;
    getTicketMock.mockReset().mockResolvedValue(ticket);
    getInternalNotesMock.mockReset().mockResolvedValue([]);
    postInternalNoteMock.mockReset();
    getStaffOwnersMock.mockReset().mockResolvedValue([]);
    claimStaffTicketMock.mockReset();
    updateStaffTicketOwnerMock.mockReset();
    updateStaffTicketItPriorityMock.mockReset();
    downloadTicketAttachmentMock.mockReset();
    getTicketCommentsMock.mockReset().mockResolvedValue([]);
    postTicketCommentMock.mockReset();
    updateStaffTicketStatusMock.mockReset();
    getTicketStatusHistoryMock.mockReset().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
    refetchAuthMock.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("lists every RESOLUTION_GATE_FAILED reason beside Apply Status in returned order", async () => {
    updateStaffTicketStatusMock.mockRejectedValue(
      new ApiRequestError(
        409,
        "The Ticket does not meet the resolution requirements.",
        "RESOLUTION_GATE_FAILED",
        {
          reasons: ["OWNER_REQUIRED", "PENDING_ACTIONS", "NO_COMPLETED_ACTION"],
        }
      )
    );
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    await requestResolved();

    const section = screen.getByRole("region", { name: "Progress Ticket" });
    const reasons = await within(section).findByRole("list", {
      name: "Resolution requirements not met",
    });
    const items = within(reasons)
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");

    expect(items).toHaveLength(3);
    expect(items[0]).toMatch(/Ticket Owner/u);
    expect(items[1]).toMatch(/Planned and In Progress/u);
    expect(items[2]).toMatch(/Completed Action Taken/u);
    expect(within(section).getByRole("alert").textContent).toContain(
      "The Ticket does not meet the resolution requirements."
    );
  });

  it("announces resolution reasons and keeps focus on the status control after a gate failure", async () => {
    updateStaffTicketStatusMock.mockRejectedValue(
      new ApiRequestError(
        409,
        "The Ticket does not meet the resolution requirements.",
        "RESOLUTION_GATE_FAILED",
        { reasons: ["NO_COMPLETED_ACTION"] }
      )
    );
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    await requestResolved();

    const section = screen.getByRole("region", { name: "Progress Ticket" });
    const liveRegion = within(section).getByRole("status");
    const reasons = await within(liveRegion).findByRole("list", {
      name: "Resolution requirements not met",
    });
    const statusSelect = screen.getByLabelText("Next status");

    expect(reasons.textContent).toContain(
      "Record at least one Completed Action Taken."
    );
    expect(document.activeElement).toBe(statusSelect);
  });

  it("moves focus to the status control after a confirmed status change", async () => {
    updateStaffTicketStatusMock.mockResolvedValue({
      ...ticket,
      currentStatus: "Resolved",
      version: 3,
    });
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    await requestResolved();

    await screen.findByText("Ticket status changed to Resolved.");
    const statusSelect = screen.getByLabelText("Next status");

    expect(document.activeElement).toBe(statusSelect);
  });

  it("lets an Administrator move a Ticket through the status workflow", async () => {
    authState.user = administratorUser;
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    expect(screen.getByLabelText("Next status")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply Status" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Ticket Owner" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "IT Priority" })).toBeTruthy();
  });

  it("refreshes the Ticket summary and status history after a status change", async () => {
    updateStaffTicketStatusMock.mockResolvedValue({
      ...ticket,
      currentStatus: "Waiting for Requester",
      version: 3,
    });
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");
    await vi.waitFor(() => {
      expect(getTicketStatusHistoryMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Next status"), {
      target: { value: "Waiting for Requester" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Status" }));

    await screen.findByText("Ticket status changed to Waiting for Requester.");
    const section = screen.getByRole("region", { name: "Progress Ticket" });

    expect(
      within(section).getByText(
        "Current status: Waiting for Requester · Version 3"
      )
    ).toBeTruthy();
    expect(getTicketMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(getTicketStatusHistoryMock).toHaveBeenCalledTimes(2);
    });
  });

  it("clears resolution reasons after a later status change succeeds", async () => {
    updateStaffTicketStatusMock
      .mockRejectedValueOnce(
        new ApiRequestError(
          409,
          "The Ticket does not meet the resolution requirements.",
          "RESOLUTION_GATE_FAILED",
          { reasons: ["NO_COMPLETED_ACTION"] }
        )
      )
      .mockResolvedValueOnce({ ...ticket, currentStatus: "Resolved" });
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    await requestResolved();
    await screen.findByRole("list", {
      name: "Resolution requirements not met",
    });
    await requestResolved();

    await screen.findByText("Ticket status changed to Resolved.");
    expect(
      screen.queryByRole("list", { name: "Resolution requirements not met" })
    ).toBeNull();
  });

  it("clears the selection and reloads the Ticket after a version conflict", async () => {
    updateStaffTicketStatusMock.mockRejectedValue(
      new ApiRequestError(
        409,
        "The Ticket changed. Reload and try again.",
        "VERSION_CONFLICT"
      )
    );
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    fireEvent.change(screen.getByLabelText("Next status"), {
      target: { value: "Waiting for Requester" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Status" }));

    const section = screen.getByRole("region", { name: "Progress Ticket" });
    const alert = await within(section).findByRole("alert");
    const statusSelect =
      screen.getByLabelText<HTMLSelectElement>("Next status");

    expect(alert.textContent).toContain(
      "The Ticket changed. Reload and try again."
    );
    expect(statusSelect.value).toBe("");
    await vi.waitFor(() => {
      expect(getTicketMock).toHaveBeenCalledTimes(2);
    });
  });

  it("offers only the permitted next statuses for the current Ticket status", async () => {
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    const options = within(screen.getByLabelText("Next status"))
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual([
      "Choose a next status",
      "Waiting for Requester",
      "Resolved",
      "Cancelled",
    ]);
  });

  it("offers no next status for a terminal Ticket", async () => {
    getTicketMock.mockResolvedValue({ ...ticket, currentStatus: "Closed" });
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    expect(screen.queryByLabelText("Next status")).toBeNull();
    expect(
      screen.getByText(/This Ticket has no available next status/u)
    ).toBeTruthy();
  });

  it("lets an Administrator post Public Comments and Internal Notes", async () => {
    authState.user = administratorUser;
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    expect(
      await screen.findByRole("textbox", { name: "Public Comment" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Post Public Comment" })
    ).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Internal Note" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add Internal Note" })
    ).toBeTruthy();
  });

  it("shows Ticket status history with the legacy rollout notice", async () => {
    getTicketStatusHistoryMock.mockResolvedValue({
      items: [
        {
          actor: { displayName: "Iris IT Staff", id: 10, role: "IT Staff" },
          confirmed: false,
          createdAt: "2026-09-02T10:45:00.000Z",
          fromStatus: "New",
          id: 1,
          ticketId: 11,
          ticketVersion: 1,
          toStatus: "Open",
        },
        {
          actor: { displayName: "Iris IT Staff", id: 10, role: "IT Staff" },
          confirmed: false,
          createdAt: "2026-09-02T11:15:00.000Z",
          fromStatus: "Open",
          id: 2,
          ticketId: 11,
          ticketVersion: 2,
          toStatus: "In Progress",
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    });
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    const history = await screen.findByRole("region", {
      name: "Status history",
    });
    expect(
      within(history).getByText(
        "Earlier Ticket status changes were not recorded; this history begins with the Lab 4 rollout."
      )
    ).toBeTruthy();
    const items = await within(history).findAllByRole("listitem");
    const texts = items.map((item) => item.textContent ?? "");
    expect(texts).toHaveLength(2);
    expect(texts[0]).toMatch(/New\s*→\s*Open/u);
    expect(texts[1]).toMatch(/Open\s*→\s*In Progress/u);
    expect(
      within(items[0]).getByText(/17:45 \(Asia\/Bangkok\)$/u)
    ).toBeTruthy();
    expect(getTicketStatusHistoryMock).toHaveBeenCalledWith(
      11,
      { page: 1, pageSize: 20 },
      expect.anything()
    );
  });

  it("pages status history so changes after the first 20 stay reachable", async () => {
    getTicketStatusHistoryMock.mockImplementation(
      async (_ticketId: number, query: { page: number; pageSize: number }) =>
        await Promise.resolve({
          items:
            query.page === 1
              ? Array.from({ length: 20 }, (_, index) =>
                  historyEvent(index + 1)
                )
              : [historyEvent(21), historyEvent(22)],
          page: query.page,
          pageSize: 20,
          totalItems: 22,
          totalPages: 2,
        })
    );
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    const history = await screen.findByRole("region", {
      name: "Status history",
    });
    const pages = await within(history).findByRole("navigation", {
      name: "Status history pages",
    });
    expect(within(pages).getByText(/Page 1 of 2/u)).toBeTruthy();
    expect(within(history).getAllByRole("listitem")).toHaveLength(20);

    fireEvent.click(within(pages).getByRole("button", { name: "Next" }));

    expect(await within(history).findByText(/Ticket version 23/u)).toBeTruthy();
    expect(within(history).getAllByRole("listitem")).toHaveLength(2);
    expect(getTicketStatusHistoryMock).toHaveBeenLastCalledWith(
      11,
      { page: 2, pageSize: 20 },
      expect.anything()
    );
    expect(
      within(
        within(history).getByRole("navigation", {
          name: "Status history pages",
        })
      ).getByRole("button", { name: "Next" })
    ).toHaveProperty("disabled", true);
  });

  it("explains that Planned and In Progress Actions must be finished before cancelling", async () => {
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    fireEvent.change(screen.getByLabelText("Next status"), {
      target: { value: "Cancelled" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Status" }));

    const dialog = await screen.findByRole("alertdialog");

    expect(dialog.textContent).toMatch(
      /Complete or cancel every Planned and In Progress Action Taken before cancelling/u
    );
  });

  it("states the resolution requirements in the Resolved confirmation", async () => {
    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    fireEvent.change(screen.getByLabelText("Next status"), {
      target: { value: "Resolved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Status" }));

    const dialog = await screen.findByRole("alertdialog");

    expect(dialog.textContent).toMatch(
      /Resolving requires at least one Completed Action Taken, no Planned or In Progress Action Taken, and an active eligible Ticket Owner\./u
    );
    expect(dialog.textContent).not.toMatch(
      /No Actions Taken entry is required/u
    );
  });
});
