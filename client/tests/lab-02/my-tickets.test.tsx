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

import { RequesterProvider, useRequester } from "@/context/requester";
import { MyTicketsPage } from "@/pages/my-tickets-page";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

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

const owner = {
  displayName: "Ada Requester",
  email: "ada@example.test",
  id: 1,
};

const otherRequester = {
  displayName: "Ben Requester",
  email: "ben@example.test",
  id: 2,
};

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

const otherTicket = {
  ...ticket,
  id: 12,
  summary: "Printer outage",
  ticketNumber: "TKT-20260902-DEF456",
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

        const requestHeaders =
          input instanceof Request ? input.headers : undefined;
        const selectedRequesterId = requestHeaders?.get(
          "X-Development-Requester-Id"
        );
        let items = [ticket];
        if (
          listMode === "empty" ||
          (listMode === "search-empty" && requestUrl.searchParams.has("search"))
        ) {
          items = [];
        } else if (selectedRequesterId === otherRequester.id.toString()) {
          items = [otherTicket];
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

const ContextSwitcher = () => {
  const { selectRequester } = useRequester();

  return (
    <button
      onClick={() => {
        selectRequester(otherRequester);
      }}
      type="button"
    >
      Switch requester
    </button>
  );
};

const renderMyTickets = (withContextSwitcher = false) => {
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
      <RequesterProvider>
        <MyTicketsPage />
        {withContextSwitcher ? <ContextSwitcher /> : null}
      </RequesterProvider>
    </QueryClientProvider>
  );

  return { ...renderResult, queryClient };
};

describe("My Tickets page", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    listMode = "loaded";
    pendingListResponses = [];
    sessionStorage.clear();
    sessionStorage.setItem(
      "toktickit.development-requester",
      JSON.stringify(owner)
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lets Clear Filters clear an unsubmitted search draft", async () => {
    mockApi();
    renderMyTickets();

    await screen.findByText("21 total");
    const search = screen.getByRole("textbox", { name: "Search" });
    fireEvent.change(search, { target: { value: "draft search" } });

    const clearFilters = screen.getByRole("button", {
      name: /Clear Filters/u,
    });
    expect(clearFilters).not.toHaveProperty("disabled", true);
    fireEvent.click(clearFilters);

    expect(search).toHaveProperty("value", "");
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
    const refetch = queryClient.refetchQueries({
      queryKey: ["tickets", owner.id],
    });

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

  it("removes the previous Requester list before showing replacement data", async () => {
    mockApi();
    renderMyTickets(true);

    await screen.findByText("21 total");
    fireEvent.click(screen.getByRole("button", { name: "Switch requester" }));

    await waitFor(() => {
      expect(document.body.textContent).not.toContain(ticket.ticketNumber);
    });
    await waitFor(() => {
      expect(document.body.textContent).toContain(otherTicket.ticketNumber);
    });
  });
});
