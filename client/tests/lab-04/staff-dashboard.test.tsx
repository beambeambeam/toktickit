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

import { ApiRequestError } from "@/api/errors";
import type { StaffDashboardResponse } from "@/generated/hey-api/types.gen";
import { StaffDashboardPage } from "@/pages/staff-dashboard-page";

const { getStaffDashboardMock, navigateMock, user } = vi.hoisted(() => ({
  getStaffDashboardMock: vi.fn(),
  navigateMock: vi.fn(),
  user: {
    createdAt: "2026-09-01T00:00:00.000Z",
    displayName: "Ian IT",
    email: "ian@example.test",
    id: 7,
    isActive: true,
    mustChangePassword: false,
    role: "IT Staff",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
}));

vi.mock("@/api/staff-dashboard", () => ({
  getStaffDashboard: getStaffDashboardMock,
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
      hash,
      params,
      search,
      to,
      "aria-label": ariaLabel,
    }: {
      activeProps?: { className?: string };
      children: ReactNode;
      className?: string;
      hash?: string;
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
      const withQuery =
        queryString.length === 0 ? href : `${href}?${queryString}`;
      return (
        <a
          aria-label={ariaLabel}
          className={className ?? activeProps?.className}
          href={hash === undefined ? withQuery : `${withQuery}#${hash}`}
        >
          {children}
        </a>
      );
    },
    useNavigate: () => navigateMock,
  };
});

const owner = {
  displayName: "Ian IT",
  id: 7,
  isActive: true,
  isEligible: true,
  role: "IT Staff" as const,
};

const preview = {
  currentStatus: "Open" as const,
  id: 21,
  itPriority: "High" as const,
  owner,
  requestedPriority: "High" as const,
  resolvedAt: null,
  summary: "Campus Wi-Fi login issue",
  ticketNumber: "TKT-20261010-ABC123",
  updatedAt: "2026-10-10T04:00:00.000Z",
};

const populatedDashboard: StaffDashboardResponse = {
  counts: {
    activeByPriority: { High: 1, Low: 0, Medium: 0, Urgent: 1 },
    activeOwned: 1,
    activeUnassigned: 2,
    byStatus: {
      Cancelled: 0,
      Closed: 0,
      "In Progress": 1,
      New: 1,
      Open: 1,
      Reopened: 0,
      Resolved: 0,
      "Waiting for Requester": 0,
    },
    myActions: 1,
  },
  generatedAt: "2026-10-11T04:00:00.000Z",
  previews: {
    myActions: [
      {
        assignee: owner,
        description: "Reset the access point",
        followUpRequired: false,
        id: 31,
        status: "In Progress",
        ticket: {
          currentStatus: "In Progress",
          id: 21,
          summary: "Campus Wi-Fi login issue",
          ticketNumber: "TKT-20261010-ABC123",
        },
        ticketId: 21,
        updatedAt: "2026-10-10T05:00:00.000Z",
      },
    ],
    recentlyUpdatedTickets: [preview],
    urgentActiveTickets: [
      { ...preview, id: 22, itPriority: "Urgent" as const, owner: null },
    ],
  },
  window: {
    from: "2026-10-04T04:00:00.000Z",
    through: "2026-10-11T04:00:00.000Z",
  },
};

const emptyDashboard: StaffDashboardResponse = {
  ...populatedDashboard,
  counts: {
    activeByPriority: { High: 0, Low: 0, Medium: 0, Urgent: 0 },
    activeOwned: 0,
    activeUnassigned: 0,
    byStatus: {
      Cancelled: 0,
      Closed: 0,
      "In Progress": 0,
      New: 0,
      Open: 0,
      Reopened: 0,
      Resolved: 0,
      "Waiting for Requester": 0,
    },
    myActions: 0,
  },
  previews: {
    myActions: [],
    recentlyUpdatedTickets: [],
    urgentActiveTickets: [],
  },
};

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StaffDashboardPage />
    </QueryClientProvider>
  );
};

// Query-string order is not meaningful, so compare the parsed parameters.
const expectQueueLink = (link: HTMLElement, search: Record<string, string>) => {
  const href = new URL(link.getAttribute("href") ?? "", "http://localhost");
  expect(href.pathname).toBe("/staff/tickets");
  expect(Object.fromEntries(href.searchParams)).toEqual(search);
};

describe("Staff dashboard UI", () => {
  beforeEach(() => {
    getStaffDashboardMock.mockReset().mockResolvedValue(populatedDashboard);
    navigateMock.mockReset();
    user.role = "IT Staff";
  });

  afterEach(() => {
    cleanup();
  });

  it("gives an Administrator the same staff cards, previews, and links", async () => {
    user.role = "Administrator";
    renderDashboard();

    expectQueueLink(
      await screen.findByRole("link", { name: /Active Unassigned.*2/u }),
      { owner: "unassigned", scope: "active" }
    );
    expectQueueLink(screen.getByRole("link", { name: "Active Owned: 1" }), {
      owner: "me",
      scope: "active",
    });
    expect(
      screen.getByRole("link", { name: "My Actions: 1" }).getAttribute("href")
    ).toBe("/staff/actions");
    expect(screen.getByText("Reset the access point")).toBeTruthy();
    expect(getStaffDashboardMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Access denied/u)).toBeNull();
  });

  it("links the Active Unassigned count to the exact unassigned active queue", async () => {
    renderDashboard();

    const link = await screen.findByRole("link", {
      name: /Active Unassigned.*2/u,
    });
    expectQueueLink(link, { owner: "unassigned", scope: "active" });
  });

  it("links the Active Owned count to the active Tickets owned by the signed-in account", async () => {
    renderDashboard();

    const link = await screen.findByRole("link", {
      name: "Active Owned: 1",
    });
    expectQueueLink(link, { owner: "me", scope: "active" });
  });

  it("links each Ticket status count to the queue filtered by that exact status", async () => {
    renderDashboard();

    const statuses = [
      "New",
      "Open",
      "In Progress",
      "Waiting for Requester",
      "Reopened",
      "Resolved",
      "Closed",
      "Cancelled",
    ] as const;
    const links = await Promise.all(
      statuses.map(async (status) => ({
        link: await screen.findByRole("link", {
          name: `${status}: ${populatedDashboard.counts.byStatus[status]}`,
        }),
        status,
      }))
    );

    for (const { link, status } of links) {
      const url = new URL(
        link.getAttribute("href") ?? "",
        "https://toktickit.test"
      );
      expect(url.pathname).toBe("/staff/tickets");
      expect(url.searchParams.get("currentStatus")).toBe(status);
      expect(url.searchParams.has("scope")).toBe(false);
    }
  });

  it("links each active IT Priority count to the active queue filtered by that priority", async () => {
    renderDashboard();

    const priorities = ["Low", "Medium", "High", "Urgent"] as const;
    const links = await Promise.all(
      priorities.map(async (priority) => ({
        link: await screen.findByRole("link", {
          name: `Active ${priority}: ${populatedDashboard.counts.activeByPriority[priority]}`,
        }),
        priority,
      }))
    );

    for (const { link, priority } of links) {
      const url = new URL(
        link.getAttribute("href") ?? "",
        "https://toktickit.test"
      );
      expect(url.pathname).toBe("/staff/tickets");
      expect(url.searchParams.get("scope")).toBe("active");
      expect(url.searchParams.get("itPriority")).toBe(priority);
    }
  });

  it("links the My Actions count to the full paginated My Actions list", async () => {
    renderDashboard();

    const link = await screen.findByRole("link", { name: "My Actions: 1" });
    expect(link.getAttribute("href")).toBe("/staff/actions");
  });

  it("previews assigned pending actions and opens each one on its Ticket", async () => {
    renderDashboard();

    const section = await screen.findByRole("region", { name: "My Actions" });
    const link = within(section).getByRole("link", {
      name: /Reset the access point/u,
    });
    expect(link.getAttribute("href")).toBe("/tickets/21#action-31");
  });

  it("links Recently Updated to the exact window and each row to its Ticket", async () => {
    renderDashboard();

    const section = await screen.findByRole("region", {
      name: "Recently Updated",
    });
    const viewAll = new URL(
      within(section)
        .getByRole("link", { name: "View all" })
        .getAttribute("href") ?? "",
      "https://toktickit.test"
    );
    expect(viewAll.pathname).toBe("/staff/tickets");
    expect(viewAll.searchParams.get("scope")).toBe("recently-updated");
    expect(viewAll.searchParams.get("from")).toBe(
      populatedDashboard.window.from
    );
    expect(viewAll.searchParams.get("through")).toBe(
      populatedDashboard.window.through
    );
    expect(
      within(section)
        .getByRole("link", { name: /Campus Wi-Fi login issue/u })
        .getAttribute("href")
    ).toBe("/tickets/21");
  });

  it("previews active Urgent Tickets with their owner and links to the Urgent queue", async () => {
    renderDashboard();

    const section = await screen.findByRole("region", {
      name: "Urgent Active",
    });
    const viewAll = new URL(
      within(section)
        .getByRole("link", { name: "View all" })
        .getAttribute("href") ?? "",
      "https://toktickit.test"
    );
    expect(viewAll.pathname).toBe("/staff/tickets");
    expect(viewAll.searchParams.get("scope")).toBe("urgent-active");
    expect(
      within(section)
        .getByRole("link", { name: /Campus Wi-Fi login issue/u })
        .getAttribute("href")
    ).toBe("/tickets/22");
    expect(within(section).getByText("Unassigned")).toBeTruthy();
  });

  it("shows a distinct loading state until the dashboard arrives", async () => {
    let resolveDashboard: ((value: StaffDashboardResponse) => void) | undefined;
    // oxlint-disable-next-line promise/avoid-new -- The test controls the loading response.
    const pending = new Promise<StaffDashboardResponse>((resolve) => {
      resolveDashboard = resolve;
    });
    getStaffDashboardMock.mockReturnValueOnce(pending);
    renderDashboard();

    expect(screen.getByText("Loading your dashboard…")).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /Active Unassigned/u })
    ).toBeNull();
    resolveDashboard?.(populatedDashboard);
    await screen.findByRole("link", { name: /Active Unassigned.*2/u });
  });

  it("keeps zero counts visible and names each empty queue with a way to its list", async () => {
    getStaffDashboardMock.mockResolvedValueOnce(emptyDashboard);
    renderDashboard();

    expect(
      await screen.findByRole("link", { name: "Active Owned: 0" })
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "My Actions: 0" })).toBeTruthy();
    const myActions = screen.getByRole("region", { name: "My Actions" });
    expect(
      within(myActions).getByText(
        "No Planned or In Progress actions are assigned to you on active Tickets."
      )
    ).toBeTruthy();
    const recentlyUpdated = screen.getByRole("region", {
      name: "Recently Updated",
    });
    expect(
      within(recentlyUpdated).getByText(
        "No Tickets were updated in this 7-day window."
      )
    ).toBeTruthy();
    const urgent = screen.getByRole("region", { name: "Urgent Active" });
    expect(
      within(urgent).getByText("No active Urgent Tickets right now.")
    ).toBeTruthy();
    const queueLink = new URL(
      within(urgent)
        .getByRole("link", { name: "Ticket Queue" })
        .getAttribute("href") ?? "",
      "https://toktickit.test"
    );
    expect(queueLink.pathname).toBe("/staff/tickets");
    expect(queueLink.searchParams.get("scope")).toBe("urgent-active");
  });

  it("shows access denied without retry or counts when the API forbids the dashboard", async () => {
    getStaffDashboardMock.mockRejectedValueOnce(
      new ApiRequestError(403, "forbidden", "FORBIDDEN")
    );
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Access denied" })
    ).toBeTruthy();
    expect(
      screen.getByText("You do not have permission to view this dashboard.")
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Retry dashboard" })
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: /Active Unassigned/u })
    ).toBeNull();
  });

  it("asks for sign-in again without retry when the session has ended", async () => {
    getStaffDashboardMock.mockRejectedValueOnce(
      new ApiRequestError(401, "unauthorized", "UNAUTHORIZED")
    );
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Your session has ended" })
    ).toBeTruthy();
    expect(
      screen.getByText("Sign in again to view your dashboard.")
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Retry dashboard" })
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: /Active Unassigned/u })
    ).toBeNull();
  });

  it("hides the last counts after a failed refresh and restores focus to the window note after retry", async () => {
    renderDashboard();
    await screen.findByRole("link", { name: "Active Owned: 1" });
    getStaffDashboardMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(populatedDashboard);

    fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" }));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Dashboard could not be loaded" },
        { timeout: 5000 }
      )
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Active Owned: 1" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry dashboard" }));
    await screen.findByRole("link", { name: "Active Owned: 1" });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toMatch(/^Updated /u);
    });
  });

  it("keeps Refresh focused and ignores clicks while a refresh is in flight", async () => {
    renderDashboard();
    await screen.findByRole("link", { name: "Active Owned: 1" });
    let resolveRefresh: ((value: StaffDashboardResponse) => void) | undefined;
    // oxlint-disable-next-line promise/avoid-new -- The test controls the refresh response.
    const pending = new Promise<StaffDashboardResponse>((resolve) => {
      resolveRefresh = resolve;
    });
    getStaffDashboardMock.mockReturnValueOnce(pending);

    const refresh = screen.getByRole("button", { name: "Refresh dashboard" });
    refresh.focus();
    fireEvent.click(refresh);
    await waitFor(() => {
      expect(refresh.getAttribute("aria-disabled")).toBe("true");
    });
    fireEvent.click(refresh);

    expect(document.activeElement).toBe(refresh);
    expect(getStaffDashboardMock).toHaveBeenCalledTimes(2);
    resolveRefresh?.({
      ...populatedDashboard,
      generatedAt: "2026-10-11T05:00:00.000Z",
    });
    await waitFor(() => {
      expect(refresh.getAttribute("aria-disabled")).toBe("false");
    });
  });

  it("offers no Create Ticket action and no trend controls", async () => {
    renderDashboard();
    await screen.findByRole("link", { name: "Active Owned: 1" });

    expect(screen.queryByRole("link", { name: /Create Ticket/iu })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Create Ticket/iu })
    ).toBeNull();
    expect(screen.queryByText(/trend/iu)).toBeNull();
  });
});
