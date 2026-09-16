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
import { ApiRequestError } from "@/api/errors";
import type { StaffTicketListParams } from "@/api/staff";
import { StaffTicketQueuePage } from "@/pages/staff-ticket-queue-page";

const {
  authState,
  getStaffOwnersMock,
  getStaffTicketsMock,
  navigateMock,
  refetchAuthMock,
} = vi.hoisted(() => ({
  authState: { user: null as AuthUser | null },
  getStaffOwnersMock: vi.fn(),
  getStaffTicketsMock: vi.fn(),
  navigateMock: vi.fn(),
  refetchAuthMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof TanStackRouter>(
    "@tanstack/react-router"
  );

  return {
    ...actual,
    Link: ({
      children,
      params,
      to,
    }: {
      children: ReactNode;
      params?: { ticketId?: string };
      to?: string;
    }) => (
      <a
        href={
          to === "/tickets/$ticketId"
            ? `/tickets/${params?.ticketId ?? ""}`
            : (to ?? "/")
        }
      >
        {children}
      </a>
    ),
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/api/query-options", () => ({
  activeCategoriesQueryOptions: () => ({
    queryFn: () => [{ id: 1, name: "Network" }],
    queryKey: ["categories"],
  }),
  relatedSystemsQueryOptions: () => ({
    queryFn: () => [{ id: 2, name: "Campus Wi-Fi" }],
    queryKey: ["related-systems"],
  }),
  ticketQueryOptions: () => ({
    queryFn: () => {},
    queryKey: ["ticket"],
  }),
}));

vi.mock("@/api/staff", () => ({
  getStaffOwners: getStaffOwnersMock,
  getStaffTickets: getStaffTicketsMock,
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

const queueResponse = {
  items: [
    {
      category: { id: 1, name: "Network" },
      currentStatus: "In Progress" as const,
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
      requestedPriority: "Medium" as const,
      summary: "Campus Wi-Fi outage",
      ticketDate: "2026-09-02T10:00:00.000Z",
      ticketNumber: "TKT-20260902-QUEUE01",
      updatedAt: "2026-09-02T11:00:00.000Z",
      version: 1,
    },
  ],
  page: 1,
  pageSize: 20 as const,
  totalItems: 1,
  totalPages: 1,
};

const emptyQueueResponse = {
  ...queueResponse,
  items: [],
  totalItems: 0,
  totalPages: 0,
};

const paginatedQueueResponse = {
  ...queueResponse,
  page: 2,
  totalItems: 61,
  totalPages: 4,
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StaffTicketQueuePage />
    </QueryClientProvider>
  );
};

describe("Staff Ticket Queue page", () => {
  beforeEach(() => {
    authState.user = staffUser;
    getStaffOwnersMock.mockReset().mockResolvedValue([
      {
        displayName: "Iris IT Staff",
        id: 10,
        isActive: true,
        isEligible: true,
        role: "IT Staff",
      },
    ]);
    getStaffTicketsMock.mockReset().mockResolvedValue(queueResponse);
    navigateMock.mockReset();
    refetchAuthMock.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders queue rows, operational fields, responsive card content, and detail links", async () => {
    renderPage();

    await screen.findAllByText("TKT-20260902-QUEUE01");
    expect(screen.getByRole("heading", { name: "All Tickets" })).toBeTruthy();
    expect(screen.getAllByText("Campus Wi-Fi outage").length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Iris IT Staff").length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: "TKT-20260902-QUEUE01" })[0]
        ?.getAttribute("href")
    ).toBe("/tickets/11");
    expect(getStaffTicketsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }),
      expect.anything()
    );
  });

  it("sends strict filter changes and clears them", async () => {
    renderPage();
    await screen.findAllByText("TKT-20260902-QUEUE01");

    fireEvent.change(screen.getByLabelText("IT Priority"), {
      target: { value: "Urgent" },
    });
    fireEvent.change(screen.getByLabelText("Ticket Owner"), {
      target: { value: "unassigned" },
    });
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "queue outage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(getStaffTicketsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          itPriority: "Urgent",
          owner: "unassigned",
          page: 1,
          search: "queue outage",
        } satisfies Partial<StaffTicketListParams>),
        expect.anything()
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await waitFor(() => {
      expect(getStaffTicketsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
          sortBy: "updatedAt",
          sortDirection: "desc",
        }),
        expect.anything()
      );
    });
    expect(screen.getByLabelText("Search")).toHaveProperty("value", "");
  });

  it("shows a retryable queue failure", async () => {
    getStaffTicketsMock.mockRejectedValue(
      new Error("Temporary queue failure.")
    );
    renderPage();

    expect(
      await screen.findByText("Temporary queue failure.", undefined, {
        timeout: 5000,
      })
    ).toBeTruthy();
    getStaffTicketsMock.mockResolvedValue(queueResponse);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findAllByText("TKT-20260902-QUEUE01");
  });

  it("shows access denial and refreshes auth after a queue 403", async () => {
    getStaffTicketsMock.mockRejectedValue(
      new ApiRequestError(403, "Access forbidden", "FORBIDDEN")
    );
    renderPage();

    await screen.findByRole(
      "heading",
      { name: "Access denied" },
      { timeout: 5000 }
    );
    expect(refetchAuthMock).toHaveBeenCalled();
  });

  it("resets an owner filter when the selected owner is no longer eligible", async () => {
    getStaffTicketsMock
      .mockResolvedValueOnce(queueResponse)
      .mockRejectedValueOnce(
        new ApiRequestError(
          400,
          "The selected Ticket Owner is no longer eligible.",
          "OWNER_INELIGIBLE"
        )
      )
      .mockRejectedValueOnce(
        new ApiRequestError(
          400,
          "The selected Ticket Owner is no longer eligible.",
          "OWNER_INELIGIBLE"
        )
      )
      .mockResolvedValue(queueResponse);
    renderPage();

    await screen.findAllByText("TKT-20260902-QUEUE01");
    fireEvent.change(screen.getByLabelText("Ticket Owner"), {
      target: { value: "10" },
    });

    await waitFor(
      () => {
        expect(screen.getByLabelText("Ticket Owner")).toHaveProperty(
          "value",
          ""
        );
        expect(getStaffTicketsMock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            owner: undefined,
            page: 1,
          }),
          expect.anything()
        );
      },
      { timeout: 5000 }
    );
    expect(getStaffOwnersMock).toHaveBeenCalledTimes(2);
  });

  it("distinguishes an empty queue from filtered no-results", async () => {
    getStaffTicketsMock.mockResolvedValue(emptyQueueResponse);
    renderPage();

    await screen.findByRole("heading", { name: "No Tickets in the queue" });
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "missing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("heading", { name: "No matching Tickets" });
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await screen.findByRole("heading", { name: "No Tickets in the queue" });
  });

  it("denies a Requester before loading shared queue data", async () => {
    authState.user = { ...staffUser, role: "Requester" };
    renderPage();

    await screen.findByRole("heading", { name: "Access denied" });
    expect(getStaffTicketsMock).not.toHaveBeenCalled();
  });

  it("renders numbered pagination and forwards the selected page", async () => {
    getStaffTicketsMock.mockResolvedValue(paginatedQueueResponse);
    renderPage();

    await screen.findAllByText("TKT-20260902-QUEUE01");
    expect(screen.getByText("Page 2 of 4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to page 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to page 4" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go to page 1" }));

    await waitFor(() => {
      expect(getStaffTicketsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
        expect.anything()
      );
    });
  });

  it("announces queue loading before results arrive", async () => {
    let resolveTickets!: (value: typeof queueResponse) => void;
    getStaffTicketsMock.mockReturnValueOnce(
      // oxlint-disable-next-line promise/avoid-new -- Deferred queue response controls loading state.
      new Promise((resolve) => {
        resolveTickets = resolve;
      })
    );
    renderPage();

    expect(screen.getByText("Loading the Ticket Queue…")).toBeTruthy();
    resolveTickets(queueResponse);
    await screen.findAllByText("TKT-20260902-QUEUE01");
  });
});
