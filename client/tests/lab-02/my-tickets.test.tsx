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

import { MyTicketsPage } from "@/pages/my-tickets-page";

const { authUser, logoutMock, navigateMock } = vi.hoisted(() => ({
  authUser: {
    createdAt: "2026-09-01T00:00:00.000Z",
    displayName: "Ada Requester",
    email: "ada@example.test",
    id: 1,
    isActive: true,
    mustChangePassword: false,
    role: "Requester" as const,
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  logoutMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof TanStackRouter>(
    "@tanstack/react-router"
  );

  return {
    ...actual,
    Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    auth: { csrfToken: "csrf", user: authUser },
    authError: null,
    changePassword: vi.fn(),
    isLoading: false,
    isRefreshing: false,
    login: vi.fn(),
    logout: logoutMock,
    refetchAuth: vi.fn(),
    user: authUser,
  }),
}));

const category = { id: 1, name: "Network" };
const relatedSystem = { id: 2, name: "Campus Wi-Fi" };

const ticket = {
  category,
  currentStatus: "New" as const,
  id: 11,
  relatedSystem,
  requestedPriority: "High" as const,
  summary: "Network outage",
  ticketDate: "2026-09-02T10:00:00.000Z",
  ticketNumber: "TKT-20260902-ABC123",
  updatedAt: "2026-09-02T10:00:00.000Z",
};

type MockFetchImplementation = (
  ...arguments_: Parameters<typeof fetch>
) => Promise<Response> | Response;

let listMode: "empty" | "loaded" | "error" | "search-empty" = "loaded";
let pendingListResponses: Promise<Response>[] = [];

const getRequestUrl = (input: Parameters<typeof fetch>[0]) =>
  new URL(input instanceof Request ? input.url : input.toString());

const createDeferredResponse = () => {
  let resolveResponse: ((response: Response) => void) | undefined;
  // oxlint-disable-next-line promise/avoid-new -- Deferred response controls loading state.
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  const resolve = (response: Response) => {
    resolveResponse?.(response);
  };

  return { promise, resolve };
};

const mockApi = () => {
  const fetchMock = vi
    .fn<MockFetchImplementation>()
    // oxlint-disable-next-line promise-function-async -- mock fetch returns both immediate and deferred responses.
    .mockImplementation(async (input) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl.pathname === "/api/categories") {
        return Response.json({ items: [category] });
      }

      if (requestUrl.pathname === "/api/related-systems") {
        return Response.json({ items: [relatedSystem] });
      }

      if (requestUrl.pathname === "/api/tickets") {
        if (listMode === "error") {
          return Response.json(
            {
              error: {
                code: "TICKET_LIST_FAILURE",
                message: "Temporary list failure.",
              },
            },
            { status: 500 }
          );
        }

        const pendingListResponse = pendingListResponses.shift();
        if (pendingListResponse !== undefined) {
          return await pendingListResponse;
        }

        let items = [ticket];
        if (
          listMode === "empty" ||
          (listMode === "search-empty" && requestUrl.searchParams.has("search"))
        ) {
          items = [];
        }
        const totalItems = items.length === 0 ? 0 : 21;

        return Response.json({
          items,
          page: Number(requestUrl.searchParams.get("page") ?? 1),
          pageSize: Number(requestUrl.searchParams.get("pageSize") ?? 10),
          totalItems,
          totalPages: totalItems === 0 ? 0 : 3,
        });
      }

      return Response.json(
        { error: { code: "NOT_FOUND", message: "Not found" } },
        { status: 404 }
      );
    });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const renderMyTickets = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  });

  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <MyTicketsPage />
    </QueryClientProvider>
  );

  return { ...renderResult, queryClient };
};

describe("My Tickets page", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    listMode = "loaded";
    pendingListResponses = [];
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not render a toolbar Clear Filters action", async () => {
    mockApi();
    renderMyTickets();

    await screen.findByText("21 total");
    expect(screen.queryByRole("button", { name: /Clear Filters/u })).toBeNull();
  });

  it("announces initial loading and background refetching", async () => {
    const initialResponse = createDeferredResponse();
    pendingListResponses.push(initialResponse.promise);
    mockApi();
    const { queryClient } = renderMyTickets();
    const ticketList = screen.getByRole("region", { name: "Your tickets" });

    expect(screen.getByText("Loading your Tickets…")).toBeTruthy();
    expect(ticketList.getAttribute("aria-busy")).toBe("true");

    initialResponse.resolve(
      Response.json({
        items: [ticket],
        page: 1,
        pageSize: 10,
        totalItems: 21,
        totalPages: 3,
      })
    );
    await screen.findByText("21 Tickets loaded.");

    const refetchResponse = createDeferredResponse();
    pendingListResponses.push(refetchResponse.promise);
    const refetch = queryClient.refetchQueries({ queryKey: ["tickets"] });

    expect(await screen.findByText("Updating results…")).toBeTruthy();
    expect(ticketList.getAttribute("aria-busy")).toBe("true");

    refetchResponse.resolve(
      Response.json({
        items: [ticket],
        page: 1,
        pageSize: 10,
        totalItems: 21,
        totalPages: 3,
      })
    );
    await refetch;
    await waitFor(() => {
      expect(ticketList.getAttribute("aria-busy")).toBe("false");
    });
  });

  it("renders numbered pages and loads the selected page", async () => {
    mockApi();
    renderMyTickets();

    await screen.findByText("21 total");
    const pageTwo = screen.getByRole("button", { name: "Go to page 2" });
    fireEvent.click(pageTwo);

    await screen.findByText("Page 2 of 3");
    expect(
      screen
        .getByRole("button", { name: "Go to page 2" })
        .getAttribute("aria-current")
    ).toBe("page");
  });

  it("distinguishes a valid no-results search from an empty list", async () => {
    listMode = "search-empty";
    mockApi();
    renderMyTickets();

    await screen.findByText("21 total");
    const search = screen.getByRole("textbox", { name: "Search" });
    fireEvent.change(search, { target: { value: "does not exist" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("No matching Tickets")).toBeTruthy();
    expect(screen.queryByText("No Tickets yet")).toBeNull();
  });

  it("shows a distinct empty-owned-list state", async () => {
    listMode = "empty";
    mockApi();
    renderMyTickets();

    expect(await screen.findByText("No Tickets yet")).toBeTruthy();
    expect(
      screen.getByText("Ada Requester has not created a support request.")
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create your first Ticket" })
    ).toBeTruthy();
    expect(screen.queryByText("No matching Tickets")).toBeNull();
  });

  it("offers retry after a list failure", async () => {
    listMode = "error";
    mockApi();
    renderMyTickets();

    expect(
      await screen.findByText(
        "Could not load My Tickets.",
        {},
        { timeout: 4000 }
      )
    ).toBeTruthy();
    listMode = "loaded";
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("21 total")).toBeTruthy();
  });

  it("uses cookie credentials without a requester context header", async () => {
    const fetchMock = mockApi();
    renderMyTickets();

    await screen.findByText("21 total");
    const ticketCall = fetchMock.mock.calls.find(([input]) => {
      const requestUrl = getRequestUrl(input);
      return requestUrl.pathname === "/api/tickets";
    });
    const request = ticketCall?.[0];
    if (!(request instanceof Request)) {
      throw new Error("Expected the API client to pass a Request.");
    }
    expect(request.credentials).toBe("include");
    expect(request.headers.has("X-Development-Requester-Id")).toBe(false);
  });
});
