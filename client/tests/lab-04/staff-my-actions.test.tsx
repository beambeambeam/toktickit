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
import type {
  getStaffActions,
  StaffMyActionsParams,
} from "@/api/staff-actions";
import type { MyActionListResponse } from "@/generated/hey-api/types.gen";
import { StaffMyActionsPage } from "@/pages/staff-my-actions-page";

const { getStaffActionsMock, navigateMock, user } = vi.hoisted(() => ({
  getStaffActionsMock: vi.fn<typeof getStaffActions>(),
  navigateMock: vi.fn(),
  user: {
    createdAt: "2026-09-01T00:00:00.000Z",
    displayName: "Ian IT",
    email: "ian@example.test",
    id: 7,
    isActive: true,
    mustChangePassword: false,
    role: "IT Staff" as const,
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
}));

vi.mock("@/api/staff-actions", () => ({
  getStaffActions: getStaffActionsMock,
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

const actionRow = {
  assignee: owner,
  description: "Reset the access point",
  followUpRequired: false,
  id: 31,
  status: "In Progress" as const,
  ticket: {
    currentStatus: "Open" as const,
    id: 21,
    summary: "Campus Wi-Fi login issue",
    ticketNumber: "TKT-20261010-ABC123",
  },
  ticketId: 21,
  updatedAt: "2026-10-10T05:00:00.000Z",
};

const actionPage = (
  overrides: Partial<MyActionListResponse> = {}
): MyActionListResponse => ({
  items: [actionRow],
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
  ...overrides,
});

// 45 actions at 20 per page is 3 pages. The mock echoes the requested page.
const pagedActionResponse = (
  params: Pick<StaffMyActionsParams, "page" | "pageSize">
): MyActionListResponse =>
  actionPage({
    page: params.page,
    pageSize: params.pageSize,
    totalItems: 45,
    totalPages: 3,
  });

// oxlint-disable-next-line require-await -- the mock must return a Promise; the body has no await.
const resolveActionPage = async (
  params: Pick<StaffMyActionsParams, "page" | "pageSize">
): Promise<MyActionListResponse> => pagedActionResponse(params);

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <StaffMyActionsPage />
    </QueryClientProvider>
  );
  return { queryClient };
};

describe("Staff My Actions UI", () => {
  beforeEach(() => {
    getStaffActionsMock.mockReset().mockResolvedValue(actionPage());
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists assigned pending actions with Ticket context and opens each on its Ticket", async () => {
    renderPage();

    const link = await screen.findByRole("link", {
      name: /Reset the access point/u,
    });
    expect(link.getAttribute("href")).toBe("/tickets/21#action-31");
    expect(getStaffActionsMock).toHaveBeenCalledWith(
      { page: 1, pageSize: 20 },
      expect.anything()
    );

    const item = link.closest("li");
    if (item === null) {
      throw new TypeError("My Actions link must sit inside a list item");
    }
    const row = within(item);
    expect(row.getByText("TKT-20261010-ABC123")).toBeTruthy();
    expect(row.getByText("Campus Wi-Fi login issue")).toBeTruthy();
    expect(row.getByText("Open")).toBeTruthy();
    expect(row.getByText("Ian IT")).toBeTruthy();
    expect(
      row.getByText(/^Action In Progress\. Updated 10 Oct 2026/u)
    ).toBeTruthy();
  });

  it("offers 10, 20, and 50 per page, defaults to 20, and requests the chosen size", async () => {
    getStaffActionsMock.mockImplementation(resolveActionPage);
    renderPage();

    const select = await screen.findByLabelText<HTMLSelectElement>("Per page");
    expect(select.value).toBe("20");
    expect([...select.options].map((option) => option.value)).toEqual([
      "10",
      "20",
      "50",
    ]);

    fireEvent.change(screen.getByLabelText("Per page"), {
      target: { value: "50" },
    });
    await waitFor(() => {
      expect(getStaffActionsMock).toHaveBeenLastCalledWith(
        { page: 1, pageSize: 50 },
        expect.anything()
      );
    });
  });

  it("returns to page 1 when the page size changes", async () => {
    getStaffActionsMock.mockImplementation(resolveActionPage);
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Go to page 2" })
    );
    await screen.findByText("Page 2 of 3");

    fireEvent.change(screen.getByLabelText("Per page"), {
      target: { value: "50" },
    });
    await waitFor(() => {
      expect(getStaffActionsMock).toHaveBeenLastCalledWith(
        { page: 1, pageSize: 50 },
        expect.anything()
      );
    });
  });

  it("moves between pages with Previous, Next, and numbered controls", async () => {
    getStaffActionsMock.mockImplementation(resolveActionPage);
    renderPage();

    await screen.findByRole("navigation", { name: "My Actions pages" });
    await screen.findByText("Page 1 of 3");
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /Previous/u })
        .disabled
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Next/u }));
    await screen.findByText("Page 2 of 3");
    expect(
      screen
        .getByRole("button", { name: "Go to page 2" })
        .getAttribute("aria-current")
    ).toBe("page");

    fireEvent.click(screen.getByRole("button", { name: "Go to page 3" }));
    await screen.findByText("Page 3 of 3");
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /Next/u }).disabled
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Previous/u }));
    await screen.findByText("Page 2 of 3");
  });

  it("explains when no Planned or In Progress actions are assigned", async () => {
    getStaffActionsMock.mockResolvedValue(
      actionPage({ items: [], totalItems: 0, totalPages: 0 })
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "No assigned actions" })
    ).toBeTruthy();
    expect(
      screen.getByText(
        "No Planned or In Progress actions are assigned to you on active Tickets."
      )
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /Reset the access point/u })
    ).toBeNull();
  });

  it("shows a session-ended message for 401 without retrying", async () => {
    getStaffActionsMock.mockRejectedValue(
      new ApiRequestError(401, "Session expired.")
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Your session has ended" })
    ).toBeTruthy();
    expect(getStaffActionsMock).toHaveBeenCalledTimes(1);
  });

  it("shows an access message for 403 without retrying", async () => {
    getStaffActionsMock.mockRejectedValue(
      new ApiRequestError(403, "Forbidden.")
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Access denied" })
    ).toBeTruthy();
    expect(getStaffActionsMock).toHaveBeenCalledTimes(1);
  });

  it("announces a loading line until the first page arrives", async () => {
    let resolvePage: ((page: MyActionListResponse) => void) | undefined;
    // oxlint-disable-next-line promise/avoid-new -- The test controls the page response.
    const pending = new Promise<MyActionListResponse>((resolve) => {
      resolvePage = resolve;
    });
    getStaffActionsMock.mockReturnValue(pending);
    renderPage();

    const loading = await screen.findByText("Loading your actions…");
    expect(loading.getAttribute("role")).toBe("status");
    expect(
      screen.queryByRole("navigation", { name: "My Actions pages" })
    ).toBeNull();

    resolvePage?.(actionPage());
    await screen.findByRole("link", { name: /Reset the access point/u });
    expect(screen.queryByText("Loading your actions…")).toBeNull();
  });

  it(
    "retries a recoverable failure once and lets the user retry manually",
    { timeout: 5000 },
    async () => {
      const failure = new ApiRequestError(500, "Server error.");
      getStaffActionsMock
        .mockReset()
        .mockRejectedValueOnce(failure)
        .mockRejectedValueOnce(failure)
        .mockResolvedValue(actionPage());
      renderPage();

      expect(
        await screen.findByRole(
          "heading",
          { name: "My Actions could not be loaded" },
          { timeout: 5000 }
        )
      ).toBeTruthy();
      expect(getStaffActionsMock).toHaveBeenCalledTimes(2);

      fireEvent.click(screen.getByRole("button", { name: "Retry My Actions" }));
      expect(
        await screen.findByRole("link", { name: /Reset the access point/u })
      ).toBeTruthy();
      expect(getStaffActionsMock).toHaveBeenCalledTimes(3);
    }
  );

  it("caches pages under the account, role, page, and page size", async () => {
    const { queryClient } = renderPage();
    await screen.findByRole("link", { name: /Reset the access point/u });

    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey)
    ).toEqual([["staff-my-actions", 7, "IT Staff", 1, 20]]);
  });
});
