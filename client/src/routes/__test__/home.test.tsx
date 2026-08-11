/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomePage } from "@/routes/index";

const healthResponse = {
  service: "TokTickIT API",
  status: "ok",
} as const;

const categoryResponse = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
] as const;

const createResponse = (body: unknown, status = 200) =>
  Response.json(body, { status });

const throwConnectionFailure = (): never => {
  throw new TypeError("Failed to fetch");
};

type MockFetchImplementation = (
  ...arguments_: Parameters<typeof fetch>
) => Promise<Response> | Response;

const mockHealthAndCategories = (
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  healthImplementation: MockFetchImplementation,
  categoryImplementation: MockFetchImplementation = () =>
    createResponse(categoryResponse)
) => {
  fetchMock.mockImplementation(async (...arguments_) => {
    const [input] = arguments_;
    const requestUrl = input instanceof Request ? input.url : input.toString();

    if (new URL(requestUrl).pathname === "/api/categories") {
      return await categoryImplementation(...arguments_);
    }

    return await healthImplementation(...arguments_);
  });
};

const createDeferred = <T,>() => {
  let deferredResolve!: (value: T | PromiseLike<T>) => void;
  // eslint-disable-next-line promise/avoid-new
  const promise = new Promise<T>((resolve) => {
    deferredResolve = resolve;
  });

  return { promise, resolve: deferredResolve };
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retryDelay: 0,
      },
    },
  });

const renderHomePage = () => {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>
  );
};

describe("home health status card", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the service desk card without making initial API requests", () => {
    renderHomePage();

    expect(
      screen.getByRole("heading", { name: "TokTickIT IT Service Desk" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "[ Check System ]" })
    ).toBeTruthy();
    expect(screen.getByRole("heading").closest(".card")).not.toBeNull();
    expect(screen.queryByText(/System Status:/u)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts both checks together and waits for both to settle", async () => {
    const pendingHealthResponse = createDeferred<Response>();
    const pendingCategoryResponse = createDeferred<Response>();
    mockHealthAndCategories(
      fetchMock,
      async () => await pendingHealthResponse.promise,
      async () => await pendingCategoryResponse.promise
    );
    renderHomePage();

    const button = screen.getByRole("button", { name: "[ Check System ]" });

    act(() => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Checking...")).toBeTruthy();
      expect(
        screen.getByText("Loading supported request categories...")
      ).toBeTruthy();
      expect(button).toHaveProperty("disabled", true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(
      fetchMock.mock.calls.map(
        ([input]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname
      )
    ).toEqual(["/api/health", "/api/categories"]);

    const statusRegion = screen.getByRole("status");
    expect(statusRegion.getAttribute("aria-live")).toBe("polite");
    expect(statusRegion.getAttribute("aria-atomic")).toBe("true");

    act(() => {
      pendingHealthResponse.resolve(createResponse(healthResponse));
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
    });
    expect(
      screen.getByText("Loading supported request categories...")
    ).toBeTruthy();
    expect(button).toHaveProperty("disabled", true);

    act(() => {
      pendingCategoryResponse.resolve(createResponse(categoryResponse));
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Supported Request Categories" })
      ).toBeTruthy();
    });
    expect(button).toHaveProperty("disabled", false);
  });

  it("shows online status and the API service after a successful check", async () => {
    mockHealthAndCategories(fetchMock, () => createResponse(healthResponse));
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
    });
    expect(screen.getByText("TokTickIT API")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "[ Check System ]" })
    ).toHaveProperty("disabled", false);
  });

  it("renders the Categories returned by the API after a system check", async () => {
    mockHealthAndCategories(fetchMock, () => createResponse(healthResponse));
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Supported Request Categories",
        })
      ).toBeTruthy();
    });

    const categoryList = screen.getByRole("list");
    expect(categoryList.tagName).toBe("OL");
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent)
    ).toEqual(["Account and Access", "Hardware"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const categoryRequest = fetchMock.mock.calls[1]?.[0];
    expect(categoryRequest).toBeInstanceOf(Request);
    if (!(categoryRequest instanceof Request)) {
      throw new TypeError("Expected the Category request to be a Request");
    }
    expect(categoryRequest.url).toBe("http://localhost:3000/api/categories");
  });

  it("shows the empty Category message after a successful empty response", async () => {
    mockHealthAndCategories(
      fetchMock,
      () => createResponse(healthResponse),
      () => createResponse([])
    );
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("No supported request categories are available.")
      ).toBeTruthy();
    });
    expect(
      screen.getByRole("heading", { name: "Supported Request Categories" })
    ).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("keeps health online when the Category request fails", async () => {
    mockHealthAndCategories(
      fetchMock,
      () => createResponse(healthResponse),
      () =>
        createResponse(
          { message: "Unable to retrieve request categories" },
          500
        )
    );
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
      expect(
        screen.getByText("Unable to retrieve request categories")
      ).toBeTruthy();
    });
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("keeps the Category list when the health request fails", async () => {
    mockHealthAndCategories(fetchMock, () => {
      throw new TypeError("Failed to fetch");
    });
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Offline")).toBeTruthy();
    });
    expect(screen.getByText("Unable to connect to TokTickIT API")).toBeTruthy();
    expect(screen.getByText("Account and Access")).toBeTruthy();
  });

  it("shows one connection message when both API requests are unreachable", async () => {
    mockHealthAndCategories(
      fetchMock,
      throwConnectionFailure,
      throwConnectionFailure
    );
    renderHomePage();

    const button = screen.getByRole("button", { name: "[ Check System ]" });
    act(() => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Offline")).toBeTruthy();
      expect(button).toHaveProperty("disabled", false);
    });
    expect(
      screen.getAllByText("Unable to connect to TokTickIT API")
    ).toHaveLength(1);
    expect(
      screen.queryByRole("heading", { name: "Supported Request Categories" })
    ).toBeNull();
  });

  it("uses the Category fallback when the server has no valid message", async () => {
    mockHealthAndCategories(
      fetchMock,
      () => createResponse(healthResponse),
      () => createResponse({ message: "" }, 500)
    );
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
      expect(
        screen.getByText("Unable to load supported request categories.")
      ).toBeTruthy();
    });
  });

  it("uses the Category fallback when the response is not valid JSON", async () => {
    mockHealthAndCategories(
      fetchMock,
      () => createResponse(healthResponse),
      () =>
        new Response("not valid JSON", {
          headers: { "Content-Type": "application/json" },
        })
    );
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
      expect(
        screen.getByText("Unable to load supported request categories.")
      ).toBeTruthy();
    });
    expect(screen.queryByText("Unexpected token")).toBeNull();
  });

  it("clears a Category error while retrying both requests", async () => {
    const retriedCategoryResponse = createDeferred<Response>();
    const healthFetch = vi
      .fn<MockFetchImplementation>()
      .mockImplementation(() => createResponse(healthResponse));
    const categoryFetch = vi
      .fn<MockFetchImplementation>()
      .mockReturnValueOnce(
        createResponse(
          { message: "Unable to retrieve request categories" },
          500
        )
      )
      .mockReturnValueOnce(
        createResponse(
          { message: "Unable to retrieve request categories" },
          500
        )
      )
      .mockReturnValueOnce(retriedCategoryResponse.promise);
    mockHealthAndCategories(fetchMock, healthFetch, categoryFetch);
    renderHomePage();

    const button = screen.getByRole("button", { name: "[ Check System ]" });
    act(() => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Unable to retrieve request categories")
      ).toBeTruthy();
      expect(button).toHaveProperty("disabled", false);
    });

    act(() => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Loading supported request categories...")
      ).toBeTruthy();
    });
    expect(
      screen.queryByText("Unable to retrieve request categories")
    ).toBeNull();
    expect(button).toHaveProperty("disabled", true);

    act(() => {
      retriedCategoryResponse.resolve(
        createResponse([{ id: 3, name: "Software" }])
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Software")).toBeTruthy();
      expect(button).toHaveProperty("disabled", false);
    });
    expect(healthFetch).toHaveBeenCalledTimes(2);
    expect(categoryFetch).toHaveBeenCalledTimes(3);
  });

  it("preserves internal TypeError messages", async () => {
    const responseError = new TypeError("Response parsing failed");
    const malformedResponse = new Response("", {
      headers: { "Content-Type": "application/json" },
    });
    Object.defineProperty(malformedResponse, "text", {
      value: () => {
        throw responseError;
      },
    });
    mockHealthAndCategories(fetchMock, () => malformedResponse);
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Offline")).toBeTruthy();
    });
    expect(screen.getByText("Response parsing failed")).toBeTruthy();
    expect(screen.queryByText("Unable to connect to TokTickIT API")).toBeNull();
  });

  it("shows the returned API error message", async () => {
    mockHealthAndCategories(fetchMock, () =>
      createResponse({ message: "Health service unavailable" }, 500)
    );
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Offline")).toBeTruthy();
    });
    expect(screen.getByText("Health service unavailable")).toBeTruthy();
  });

  it("shows the client error message when the response has no JSON message", async () => {
    mockHealthAndCategories(
      fetchMock,
      () => new Response("Gateway timeout", { status: 500 })
    );
    renderHomePage();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "[ Check System ]" }));
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Offline")).toBeTruthy();
    });
    expect(screen.getByText("Gateway timeout")).toBeTruthy();
  });

  it("performs another health check after a failed check", async () => {
    const healthFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(createResponse(healthResponse));
    mockHealthAndCategories(fetchMock, healthFetch);
    renderHomePage();

    const button = screen.getByRole("button", { name: "[ Check System ]" });

    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(screen.getByText("System Status: Offline")).toBeTruthy();
    });

    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
    });
    expect(healthFetch).toHaveBeenCalledTimes(3);
  });

  it("performs another health check after a successful check", async () => {
    const secondHealthResponse = createDeferred<Response>();
    const secondCategoryResponse = createDeferred<Response>();
    const healthFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createResponse(healthResponse))
      .mockReturnValueOnce(secondHealthResponse.promise);
    const categoryFetch = vi
      .fn<MockFetchImplementation>()
      .mockReturnValueOnce(createResponse(categoryResponse))
      .mockReturnValueOnce(secondCategoryResponse.promise);
    mockHealthAndCategories(fetchMock, healthFetch, categoryFetch);
    renderHomePage();

    const button = screen.getByRole("button", { name: "[ Check System ]" });

    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
    });
    expect(screen.getByText("Account and Access")).toBeTruthy();

    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(screen.getByText("System Status: Checking...")).toBeTruthy();
      expect(
        screen.getByText("Loading supported request categories...")
      ).toBeTruthy();
      expect(button).toHaveProperty("disabled", true);
    });
    expect(screen.queryByText("Account and Access")).toBeNull();

    act(() => {
      secondHealthResponse.resolve(createResponse(healthResponse));
      secondCategoryResponse.resolve(
        createResponse([{ id: 3, name: "Software" }])
      );
    });
    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
    });
    expect(screen.getByText("Software")).toBeTruthy();
    expect(screen.queryByText("Account and Access")).toBeNull();
    expect(healthFetch).toHaveBeenCalledTimes(2);
    expect(categoryFetch).toHaveBeenCalledTimes(2);
  });
});
