/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as TanStackRouter from "@tanstack/react-router";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/api/auth";
import { AppShell } from "@/components/app-shell";
import type {
  RequesterDashboardResponse,
  StaffDashboardResponse,
} from "@/generated/hey-api/types.gen";
import { DashboardPage } from "@/pages/dashboard-page";

const {
  authState,
  getRequesterDashboardMock,
  getStaffDashboardMock,
  logoutMock,
  navigateMock,
} = vi.hoisted(() => ({
  authState: { user: null as AuthUser | null },
  getRequesterDashboardMock: vi.fn(),
  getStaffDashboardMock: vi.fn(),
  logoutMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("@/api/requester-dashboard", () => ({
  getRequesterDashboard: getRequesterDashboardMock,
}));

vi.mock("@/api/staff-dashboard", () => ({
  getStaffDashboard: getStaffDashboardMock,
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
    logout: logoutMock,
    refetchAuth: vi.fn(),
    user: authState.user,
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
      "aria-label"?: string;
      children: ReactNode;
      className?: string;
      hash?: string;
      params?: Record<string, string>;
      search?: Record<string, string | number | undefined>;
      to: string;
    }) => {
      let href = to;
      for (const [key, value] of Object.entries(params ?? {})) {
        href = href.replace(`$${key}`, value);
      }
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(search ?? {})) {
        if (value !== undefined) {
          query.set(key, String(value));
        }
      }
      const queryString = query.toString();
      const queryPart = queryString.length === 0 ? "" : `?${queryString}`;
      const hashPart = hash === undefined ? "" : `#${hash}`;
      return (
        <a
          aria-label={ariaLabel}
          className={className}
          data-active-class={activeProps?.className}
          href={`${href}${queryPart}${hashPart}`}
        >
          {children}
        </a>
      );
    },
    useNavigate: () => navigateMock,
  };
});

const account = (role: AuthUser["role"]): AuthUser => ({
  createdAt: "2026-09-01T00:00:00.000Z",
  displayName: `${role} Person`,
  email: "person@example.test",
  id: 7,
  isActive: true,
  mustChangePassword: false,
  role,
  updatedAt: "2026-09-01T00:00:00.000Z",
});

const emptyStaffDashboard: StaffDashboardResponse = {
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
  generatedAt: "2026-10-11T04:00:00.000Z",
  previews: {
    myActions: [],
    recentlyUpdatedTickets: [],
    urgentActiveTickets: [],
  },
  window: {
    from: "2026-10-04T04:00:00.000Z",
    through: "2026-10-11T04:00:00.000Z",
  },
};

const emptyRequesterDashboard: RequesterDashboardResponse = {
  counts: {
    activeTickets: 0,
    recentlyResolved: 0,
    recentlyUpdated: 0,
    waitingForRequester: 0,
  },
  generatedAt: "2026-10-11T04:00:00.000Z",
  previews: { recentlyResolved: [], recentlyUpdated: [] },
  window: {
    from: "2026-10-04T04:00:00.000Z",
    through: "2026-10-11T04:00:00.000Z",
  },
};

type NavigationName = "Mobile navigation" | "Primary navigation";
const NAVIGATIONS: readonly NavigationName[] = [
  "Primary navigation",
  "Mobile navigation",
];

const navLink = (navigation: NavigationName, name: string) =>
  within(
    screen.getByRole("navigation", { hidden: true, name: navigation })
  ).queryByRole("link", { hidden: true, name });

const renderShell = (role: AuthUser["role"]) => {
  authState.user = account(role);
  return render(
    <AppShell
      allowedRoles={["Requester", "IT Staff", "Administrator"]}
      title="Dashboard"
    >
      <p>Workspace body</p>
    </AppShell>
  );
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
};

describe("workspace navigation", () => {
  beforeEach(() => {
    authState.user = null;
    logoutMock.mockReset();
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists Dashboard, My Actions, and Ticket Queue for IT Staff without User Management", () => {
    renderShell("IT Staff");
    for (const navigation of NAVIGATIONS) {
      expect(navLink(navigation, "Dashboard")?.getAttribute("href")).toBe(
        "/dashboard"
      );
      expect(navLink(navigation, "My Actions")?.getAttribute("href")).toBe(
        "/staff/actions"
      );
      expect(navLink(navigation, "Ticket Queue")?.getAttribute("href")).toBe(
        "/staff/tickets"
      );
      expect(navLink(navigation, "User Management")).toBeNull();
    }
  });

  it("lists the same staff destinations plus User Management for Administrators", () => {
    renderShell("Administrator");
    for (const navigation of NAVIGATIONS) {
      expect(navLink(navigation, "Dashboard")?.getAttribute("href")).toBe(
        "/dashboard"
      );
      expect(navLink(navigation, "My Actions")?.getAttribute("href")).toBe(
        "/staff/actions"
      );
      expect(navLink(navigation, "Ticket Queue")?.getAttribute("href")).toBe(
        "/staff/tickets"
      );
      expect(navLink(navigation, "User Management")?.getAttribute("href")).toBe(
        "/users"
      );
    }
  });

  it("keeps Requester links and omits staff-only destinations", () => {
    renderShell("Requester");
    for (const navigation of NAVIGATIONS) {
      expect(navLink(navigation, "Dashboard")?.getAttribute("href")).toBe(
        "/dashboard"
      );
      expect(navLink(navigation, "My Tickets")?.getAttribute("href")).toBe(
        "/tickets"
      );
      expect(navLink(navigation, "Create Ticket")?.getAttribute("href")).toBe(
        "/create"
      );
      expect(navLink(navigation, "My Actions")).toBeNull();
      expect(navLink(navigation, "Ticket Queue")).toBeNull();
    }
  });

  it("marks the current workspace destinations with an active class on desktop and mobile", () => {
    renderShell("Administrator");
    for (const navigation of NAVIGATIONS) {
      for (const name of [
        "Dashboard",
        "My Actions",
        "Ticket Queue",
        "User Management",
      ]) {
        expect(navLink(navigation, name)?.dataset.activeClass).toContain(
          "active"
        );
      }
    }
  });
});

describe("role-aware Dashboard route", () => {
  beforeEach(() => {
    authState.user = null;
    getRequesterDashboardMock.mockReset();
    getStaffDashboardMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it.each(["IT Staff", "Administrator"] as const)(
    "serves the staff dashboard to %s",
    async (role) => {
      authState.user = account(role);
      getStaffDashboardMock.mockResolvedValue(emptyStaffDashboard);
      renderPage();

      expect(
        await screen.findByRole("region", { name: "Ticket metrics" })
      ).toBeTruthy();
      expect(getStaffDashboardMock).toHaveBeenCalledTimes(1);
      expect(getRequesterDashboardMock).not.toHaveBeenCalled();
    }
  );

  it("serves the Requester dashboard to Requesters", async () => {
    authState.user = account("Requester");
    getRequesterDashboardMock.mockResolvedValue(emptyRequesterDashboard);
    renderPage();

    await waitFor(() => {
      expect(getRequesterDashboardMock).toHaveBeenCalledTimes(1);
    });
    expect(getStaffDashboardMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Ticket metrics" })).toBeNull();
  });
});
