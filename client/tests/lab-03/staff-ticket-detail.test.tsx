/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as TanStackRouter from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
  getStaffOwnersMock,
  getTicketCommentsMock,
  getTicketMock,
  postTicketCommentMock,
  refetchAuthMock,
  updateStaffTicketItPriorityMock,
  updateStaffTicketOwnerMock,
  updateStaffTicketStatusMock,
} = vi.hoisted(() => ({
  authState: { user: null as AuthUser | null },
  claimStaffTicketMock: vi.fn(),
  downloadTicketAttachmentMock: vi.fn(),
  getStaffOwnersMock: vi.fn<() => Promise<Owner[]>>(),
  getTicketCommentsMock: vi.fn(),
  getTicketMock: vi.fn(),
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

vi.mock("@/api/ticket-comments", () => ({
  getTicketComments: getTicketCommentsMock,
  postTicketComment: postTicketCommentMock,
}));

vi.mock("@/api/staff", () => ({
  claimStaffTicket: claimStaffTicketMock,
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

const adminUser: AuthUser = {
  createdAt: "2026-09-01T00:00:00.000Z",
  displayName: "Ari Administrator",
  email: "admin@example.test",
  id: 20,
  isActive: true,
  mustChangePassword: false,
  role: "Administrator",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const staffUser: AuthUser = {
  ...adminUser,
  displayName: "Iris IT Staff",
  email: "staff@example.test",
  id: 10,
  role: "IT Staff",
};

const activeAttachment = {
  byteSize: 12_345,
  id: 101,
  mediaType: "application/pdf",
  originalFilename: "queue-evidence.pdf",
  removalReason: null,
  removedAt: null,
  state: "Active" as const,
  uploadedAt: "2026-09-02T10:00:00.000Z",
};

const removedAttachment = {
  byteSize: 9876,
  id: 102,
  mediaType: "text/plain",
  originalFilename: "old-log.txt",
  removalReason: "Superseded evidence",
  removedAt: "2026-09-02T11:00:00.000Z",
  state: "Removed" as const,
  uploadedAt: "2026-09-02T09:00:00.000Z",
};

const ticket = {
  attachments: [activeAttachment, removedAttachment],
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

describe("Staff Ticket Detail page", () => {
  beforeEach(() => {
    authState.user = adminUser;
    getTicketMock.mockReset().mockResolvedValue(ticket);
    getStaffOwnersMock.mockReset().mockResolvedValue([
      {
        displayName: "Iris IT Staff",
        id: 10,
        isActive: true,
        isEligible: true,
        role: "IT Staff",
      },
      {
        displayName: "Jules IT Staff",
        id: 12,
        isActive: true,
        isEligible: true,
        role: "IT Staff",
      },
    ]);
    claimStaffTicketMock.mockReset();
    updateStaffTicketOwnerMock.mockReset();
    updateStaffTicketItPriorityMock.mockReset();
    downloadTicketAttachmentMock.mockReset();
    getTicketCommentsMock.mockReset().mockResolvedValue([]);
    postTicketCommentMock.mockReset();
    updateStaffTicketStatusMock.mockReset();
    refetchAuthMock.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders submitted Ticket data and attachments as read-only for Administrators", async () => {
    renderPage();

    await screen.findByText("TKT-20260902-DETAIL01");
    expect(screen.getByText("Ada Requester · ada@example.test")).toBeTruthy();
    expect(screen.getByText("Campus Wi-Fi outage")).toBeTruthy();
    expect(screen.getAllByText("Medium").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getByText("Iris IT Staff")).toBeTruthy();
    expect(screen.getByText("queue-evidence.pdf")).toBeTruthy();
    expect(screen.getByText("old-log.txt")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Add Attachment/u })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Upload/u })).toBeNull();
  });

  it("scopes detail data to the authenticated principal", async () => {
    const { queryClient } = renderPage();

    await screen.findByText("TKT-20260902-DETAIL01");

    expect(queryClient.getQueryData(["ticket", adminUser.id, 11])).toEqual(
      ticket
    );
    expect(queryClient.getQueryData(["ticket", 11])).toBeUndefined();
  });

  it("shows a retryable failure and avoids the API for an invalid Ticket Number", async () => {
    getTicketMock
      .mockRejectedValueOnce(new Error("Ticket was not found."))
      .mockResolvedValueOnce(ticket);
    renderPage();

    await screen.findByText("Ticket was not found.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("TKT-20260902-DETAIL01");

    cleanup();
    getTicketMock.mockReset();
    renderPage("not-a-ticket");
    await screen.findByRole("heading", { name: "Invalid Ticket Number" });
    expect(getTicketMock).not.toHaveBeenCalled();
  });

  it("shows access denial and refreshes auth after a detail 403", async () => {
    getTicketMock.mockRejectedValue(
      new ApiRequestError(403, "Access forbidden", "FORBIDDEN")
    );
    renderPage();

    await screen.findByRole("heading", { name: "Access denied" });
    expect(refetchAuthMock).toHaveBeenCalled();
  });

  it("shows allowed status transitions and confirms terminal progress", async () => {
    authState.user = staffUser;
    updateStaffTicketStatusMock.mockResolvedValue({
      ...ticket,
      currentStatus: "Resolved",
      resolvedAt: "2026-09-02T12:00:00.000Z",
      statusChangedAt: "2026-09-02T12:00:00.000Z",
      updatedAt: "2026-09-02T12:00:00.000Z",
      version: 3,
    });
    renderPage();

    await screen.findByText("TKT-20260902-DETAIL01");
    const statusSelect = screen.getByLabelText("Next status");
    expect(statusSelect).toHaveProperty("value", "");
    fireEvent.change(statusSelect, { target: { value: "Resolved" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Status" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/No Actions Taken entry is required/u)
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm Resolved" })
    );

    await waitFor(() => {
      expect(updateStaffTicketStatusMock).toHaveBeenCalledWith(11, {
        confirmed: true,
        currentStatus: "Resolved",
        version: 2,
      });
    });
    expect(
      await screen.findByText("Ticket status changed to Resolved.")
    ).toBeTruthy();
  });

  it("uses the Ticket version captured when confirmation opens", async () => {
    authState.user = staffUser;
    updateStaffTicketStatusMock.mockResolvedValue({
      ...ticket,
      currentStatus: "Resolved",
      version: 3,
    });
    const { queryClient } = renderPage();

    await screen.findByText("TKT-20260902-DETAIL01");
    fireEvent.change(screen.getByLabelText("Next status"), {
      target: { value: "Resolved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Status" }));
    const dialog = await screen.findByRole("alertdialog");

    queryClient.setQueryData(["ticket", staffUser.id, 11], {
      ...ticket,
      currentStatus: "Waiting for Requester",
      version: 3,
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm Resolved" })
    );

    await waitFor(() => {
      expect(updateStaffTicketStatusMock).toHaveBeenCalledWith(11, {
        confirmed: true,
        currentStatus: "Resolved",
        version: 2,
      });
    });
  });

  it("traps confirmation focus, supports Escape, and restores the trigger", async () => {
    authState.user = staffUser;
    renderPage();

    await screen.findByText("TKT-20260902-DETAIL01");
    const trigger = screen.getByRole("button", { name: "Apply Status" });
    fireEvent.change(screen.getByLabelText("Next status"), {
      target: { value: "Resolved" },
    });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", {
      name: "Confirm Resolved",
    });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("downloads only active Attachment content", async () => {
    downloadTicketAttachmentMock.mockResolvedValue({
      blob: new Blob(["evidence"], { type: "application/pdf" }),
      filename: "queue-evidence.pdf",
    });
    window.URL.createObjectURL = vi.fn(() => "blob:mock");
    window.URL.revokeObjectURL = vi.fn((): void => {});
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderPage();
    await screen.findByText("queue-evidence.pdf");
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(downloadTicketAttachmentMock).toHaveBeenCalledWith(11, 101);
    });
    expect(clickSpy).toHaveBeenCalled();
  });

  it("preserves the current Owner when Save Owner is unchanged", async () => {
    authState.user = staffUser;
    updateStaffTicketOwnerMock.mockResolvedValue(ticket);

    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");
    fireEvent.click(screen.getByRole("button", { name: "Save Owner" }));

    await waitFor(() => {
      expect(updateStaffTicketOwnerMock).toHaveBeenCalledWith(11, {
        ownerId: staffUser.id,
        version: ticket.version,
      });
    });
  });

  it("lets IT Staff save Owner and IT Priority with the current version", async () => {
    authState.user = staffUser;
    const unassignedTicket = { ...ticket, owner: null };
    getTicketMock.mockResolvedValue(unassignedTicket);
    const updatedTicket = {
      ...unassignedTicket,
      itPriority: "Urgent" as const,
      owner: {
        displayName: "Jules IT Staff",
        id: 12,
        isActive: true,
        isEligible: true,
        role: "IT Staff" as const,
      },
      version: 4,
    };
    updateStaffTicketOwnerMock.mockResolvedValue({
      ...updatedTicket,
      itPriority: "High" as const,
      version: 3,
    });
    updateStaffTicketItPriorityMock.mockResolvedValue(updatedTicket);

    renderPage();
    await screen.findByText("TKT-20260902-DETAIL01");

    fireEvent.change(screen.getByLabelText("Ticket Owner"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Owner" }));
    await waitFor(() => {
      expect(updateStaffTicketOwnerMock).toHaveBeenCalledWith(11, {
        ownerId: 12,
        version: 2,
      });
    });

    fireEvent.change(screen.getByLabelText("IT Priority"), {
      target: { value: "Urgent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save IT Priority" }));
    await waitFor(() => {
      expect(updateStaffTicketItPriorityMock).toHaveBeenCalledWith(11, {
        itPriority: "Urgent",
        version: 3,
      });
    });
    expect(
      await screen.findByText("IT Priority saved successfully.")
    ).toBeTruthy();
  });
});
