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

import type { TicketListParams } from "@/api/requester";
import type * as RequesterApi from "@/api/requester";
import type { TicketListResponse } from "@/generated/hey-api/types.gen";
import type { MyTicketsInitialFilters } from "@/pages/my-tickets-page";
import { MyTicketsPage } from "@/pages/my-tickets-page";

const { getTicketsMock, navigateMock, user } = vi.hoisted(() => ({
  getTicketsMock:
    vi.fn<(params: TicketListParams) => Promise<TicketListResponse>>(),
  navigateMock: vi.fn(),
  user: {
    createdAt: "2026-09-01T00:00:00.000Z",
    displayName: "Ada Requester",
    email: "ada@example.test",
    id: 12,
    isActive: true,
    mustChangePassword: false,
    role: "Requester" as const,
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
}));

vi.mock("@/api/requester", async () => {
  const actual = await vi.importActual<typeof RequesterApi>("@/api/requester");
  return { ...actual, getTickets: getTicketsMock };
});

vi.mock("@/api/query-options", () => ({
  activeCategoriesQueryOptions: () => ({
    queryFn: () => [],
    queryKey: ["categories"],
  }),
  relatedSystemsQueryOptions: () => ({
    queryFn: () => [],
    queryKey: ["related-systems"],
  }),
  ticketsQueryOptions: (params: TicketListParams) => ({
    queryFn: async () => {
      const tickets = await getTicketsMock(params);
      return tickets;
    },
    queryKey: ["tickets", params],
    retry: false,
  }),
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    auth: { csrfToken: "csrf", user },
    authError: null,
    changePassword: vi.fn(),
    isLoading: false,
    isRefreshing: false,
    login: vi.fn(),
    logout: vi.fn(),
    refetchAuth: vi.fn(),
    user,
  }),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof TanStackRouter>(
    "@tanstack/react-router"
  );
  return {
    ...actual,
    Link: ({ children, to }: { children: ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useNavigate: () => navigateMock,
  };
});

const listResponse: TicketListResponse = {
  items: [],
  page: 1,
  pageSize: 10 as const,
  totalItems: 0,
  totalPages: 0,
};

const renderMyTickets = (initialFilters: MyTicketsInitialFilters) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MyTicketsPage initialFilters={initialFilters} />
    </QueryClientProvider>
  );
};

describe("Dashboard drill-down UI", () => {
  beforeEach(() => {
    getTicketsMock.mockReset().mockResolvedValue(listResponse);
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("applies the exact dashboard scope and UTC bounds to My Tickets", async () => {
    const from = "2026-10-04T04:00:00.000Z";
    const through = "2026-10-11T04:00:00.000Z";
    renderMyTickets({ from, scope: "recently-updated", through });

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from,
          page: 1,
          scope: "recently-updated",
          through,
        })
      );
    });
    expect(
      screen
        .getByRole("button", { name: /Clear Filters/u })
        .hasAttribute("disabled")
    ).toBe(false);
    expect(screen.getByText(/recently updated/iu)).toBeTruthy();
  });

  it("clears dashboard scope and date bounds without dropping My Tickets", async () => {
    renderMyTickets({
      from: "2026-10-04T04:00:00.000Z",
      scope: "recently-resolved",
      through: "2026-10-11T04:00:00.000Z",
    });

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: /Clear Filters/u }));
    await waitFor(() => {
      expect(getTicketsMock.mock.lastCall?.[0]?.scope).toBeUndefined();
      expect(getTicketsMock.mock.lastCall?.[0]?.from).toBeUndefined();
      expect(getTicketsMock.mock.lastCall?.[0]?.through).toBeUndefined();
    });
  });
});
