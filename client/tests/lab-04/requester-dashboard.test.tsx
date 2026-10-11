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

import { ApiRequestError } from "@/api/errors";
import { homeRouteForRole } from "@/components/app-shell";
import type { RequesterDashboardResponse } from "@/generated/hey-api/types.gen";
import { RequesterDashboardPage } from "@/pages/requester-dashboard-page";

const { getRequesterDashboardMock, navigateMock, user } = vi.hoisted(() => ({
  getRequesterDashboardMock: vi.fn(),
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

vi.mock("@/api/requester-dashboard", () => ({
  getRequesterDashboard: getRequesterDashboardMock,
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
    Link: ({
      activeProps,
      children,
      className,
      params,
      search,
      to,
      "aria-label": ariaLabel,
    }: {
      activeProps?: { className?: string };
      children: ReactNode;
      className?: string;
      params?: Record<string, string | number>;
      search?: Record<string, string | number | undefined>;
      to: string;
      "aria-label"?: string;
    }) => {
      let href = to;
      for (const [key, value] of Object.entries(params ?? {})) {
        href = href.replace(`$${key}`, String(value));
      }
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(search ?? {})) {
        if (value !== undefined) {
          query.set(key, String(value));
        }
      }
      const queryString = query.toString();
      return (
        <a
          aria-label={ariaLabel}
          className={className ?? activeProps?.className}
          href={queryString.length === 0 ? href : `${href}?${queryString}`}
        >
          {children}
        </a>
      );
    },
    useNavigate: () => navigateMock,
  };
});

const preview = {
  currentStatus: "Open" as const,
  id: 21,
  requestedPriority: "High" as const,
  resolvedAt: null,
  summary: "Campus Wi-Fi login issue",
  ticketNumber: "TKT-20261010-ABC123",
  updatedAt: "2026-10-10T04:00:00.000Z",
};

const populatedDashboard: RequesterDashboardResponse = {
  counts: {
    activeTickets: 2,
    recentlyResolved: 1,
    recentlyUpdated: 1,
    waitingForRequester: 1,
  },
  generatedAt: "2026-10-11T04:00:00.000Z",
  previews: {
    recentlyResolved: [
      {
        ...preview,
        currentStatus: "Resolved",
        id: 20,
        requestedPriority: "Medium",
        resolvedAt: "2026-10-09T04:00:00.000Z",
        summary: "VPN access restored",
        ticketNumber: "TKT-20261009-DEF456",
      },
    ],
    recentlyUpdated: [preview],
  },
  window: {
    from: "2026-10-04T04:00:00.000Z",
    through: "2026-10-11T04:00:00.000Z",
  },
};

const emptyDashboard: RequesterDashboardResponse = {
  ...populatedDashboard,
  counts: {
    activeTickets: 0,
    recentlyResolved: 0,
    recentlyUpdated: 0,
    waitingForRequester: 0,
  },
  previews: { recentlyResolved: [], recentlyUpdated: [] },
};

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RequesterDashboardPage />
      </QueryClientProvider>
    ),
  };
};

describe("Requester dashboard UI", () => {
  beforeEach(() => {
    getRequesterDashboardMock.mockReset().mockResolvedValue(populatedDashboard);
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows public metrics, Bangkok time, and exact card and preview links", async () => {
    renderDashboard();

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(await screen.findByText("Campus Wi-Fi login issue")).toBeTruthy();
    expect(screen.getAllByText(/Asia\/Bangkok/u).length).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("link", { name: /Active Tickets.*2/u })
        .getAttribute("href")
    ).toBe("/tickets?scope=active");
    expect(
      screen
        .getByRole("link", { name: /Waiting for You.*1/u })
        .getAttribute("href")
    ).toBe("/tickets?scope=waiting-for-requester");

    const updatedHref = screen
      .getByRole("link", { name: /Recently Updated.*1/u })
      .getAttribute("href");
    const updatedUrl = new URL(updatedHref ?? "", "http://localhost");
    expect(updatedUrl.searchParams.get("scope")).toBe("recently-updated");
    expect(updatedUrl.searchParams.get("from")).toBe(
      populatedDashboard.window.from
    );
    expect(updatedUrl.searchParams.get("through")).toBe(
      populatedDashboard.window.through
    );

    const resolvedHref = screen
      .getByRole("link", { name: /Recently Resolved.*1/u })
      .getAttribute("href");
    const resolvedUrl = new URL(resolvedHref ?? "", "http://localhost");
    expect(resolvedUrl.searchParams.get("scope")).toBe("recently-resolved");
    expect(resolvedUrl.searchParams.get("from")).toBe(
      populatedDashboard.window.from
    );
    expect(resolvedUrl.searchParams.get("through")).toBe(
      populatedDashboard.window.through
    );
    expect(
      screen
        .getByRole("link", {
          name: /TKT-20261010-ABC123.*Campus Wi-Fi login issue/u,
        })
        .getAttribute("href")
    ).toBe("/tickets/21");
  });

  it("keeps zero counts visible and names empty preview states", async () => {
    getRequesterDashboardMock.mockResolvedValueOnce(emptyDashboard);
    renderDashboard();

    await screen.findByText(
      "No Tickets were updated in this seven-day window."
    );
    expect(
      screen.getByRole("link", { name: /Active Tickets.*0/u })
    ).toBeTruthy();
    expect(
      screen.getByText("No Tickets were resolved in this seven-day window.")
    ).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: "My Tickets" }).length
    ).toBeGreaterThan(0);
  });

  it("shows a distinct loading state and a refresh action", async () => {
    let resolveDashboard:
      | ((value: RequesterDashboardResponse) => void)
      | undefined;
    // oxlint-disable-next-line promise/avoid-new -- The test controls the loading response.
    const pending = new Promise<RequesterDashboardResponse>((resolve) => {
      resolveDashboard = resolve;
    });
    getRequesterDashboardMock.mockReturnValueOnce(pending);
    renderDashboard();

    expect(screen.getByText("Loading your dashboard…")).toBeTruthy();
    resolveDashboard?.(populatedDashboard);
    await screen.findByText("Campus Wi-Fi login issue");
    expect(
      screen.getByRole("button", { name: "Refresh dashboard" })
    ).toBeTruthy();
  });

  it("keeps focus on Refresh and ignores clicks while refreshing", async () => {
    getRequesterDashboardMock.mockResolvedValueOnce(populatedDashboard);
    renderDashboard();
    await screen.findByText("Campus Wi-Fi login issue");
    let resolveRefresh:
      | ((value: RequesterDashboardResponse) => void)
      | undefined;
    // oxlint-disable-next-line promise/avoid-new -- The test controls the refresh response.
    const pending = new Promise<RequesterDashboardResponse>((resolve) => {
      resolveRefresh = resolve;
    });
    getRequesterDashboardMock.mockReturnValueOnce(pending);

    const refresh = screen.getByRole("button", { name: "Refresh dashboard" });
    refresh.focus();
    fireEvent.click(refresh);
    await waitFor(() => {
      expect(refresh.getAttribute("aria-disabled")).toBe("true");
    });
    fireEvent.click(refresh);

    expect(document.activeElement).toBe(refresh);
    expect(getRequesterDashboardMock).toHaveBeenCalledTimes(2);
    resolveRefresh?.(populatedDashboard);
    await waitFor(() => {
      expect(refresh.getAttribute("aria-disabled")).toBe("false");
    });
  });

  it("separates forbidden access and retryable network failures", async () => {
    getRequesterDashboardMock.mockRejectedValueOnce(
      new ApiRequestError(403, "forbidden", "FORBIDDEN")
    );
    const { unmount } = renderDashboard();
    expect(
      await screen.findByText(
        "You do not have permission to view this dashboard."
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retry dashboard" })
    ).toBeTruthy();
    unmount();

    getRequesterDashboardMock
      .mockReset()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(populatedDashboard);
    renderDashboard();
    expect(
      await screen.findByText(
        "Could not load your dashboard. Check your connection and try again.",
        undefined,
        { timeout: 5000 }
      )
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry dashboard" }));
    await screen.findByText("Campus Wi-Fi login issue");
    await waitFor(() => {
      expect(getRequesterDashboardMock).toHaveBeenCalledTimes(3);
    });
  });

  it("uses Dashboard as the Requester landing and keeps the other roles on their current routes", () => {
    expect(homeRouteForRole("Requester")).toBe("/dashboard");
    expect(homeRouteForRole("IT Staff")).toBe("/staff/tickets");
    expect(homeRouteForRole("Administrator")).toBe("/users");
  });
});
