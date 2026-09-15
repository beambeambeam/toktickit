/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as TanStackRouter from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/api/auth";
import { StaffTicketDetailPage } from "@/pages/staff-ticket-detail-page";

const { authState, downloadTicketAttachmentMock, getTicketMock } = vi.hoisted(
  () => ({
    authState: { user: null as AuthUser | null },
    downloadTicketAttachmentMock: vi.fn(),
    getTicketMock: vi.fn(),
  })
);

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
  ticketQueryOptions: (ticketId: number) => ({
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const result: unknown = await getTicketMock(ticketId, signal);
      return result;
    },
    queryKey: ["ticket", ticketId],
    retry: false,
  }),
}));

vi.mock("@/api/requester", () => ({
  downloadTicketAttachment: downloadTicketAttachmentMock,
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
    refetchAuth: vi.fn(),
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

  return render(
    <QueryClientProvider client={queryClient}>
      <StaffTicketDetailPage ticketId={ticketId} />
    </QueryClientProvider>
  );
};

describe("Staff Ticket Detail page", () => {
  beforeEach(() => {
    authState.user = adminUser;
    getTicketMock.mockReset().mockResolvedValue(ticket);
    downloadTicketAttachmentMock.mockReset();
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
});
