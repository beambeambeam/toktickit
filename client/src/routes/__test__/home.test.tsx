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

type MockFetchImplementation = (
  ...arguments_: Parameters<typeof fetch>
) => Promise<Response> | Response;

const mockHealthAndCategories = (
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  healthImplementation: MockFetchImplementation
) => {
  fetchMock.mockImplementation(async (...arguments_) => {
    const [input] = arguments_;
    const requestUrl = input instanceof Request ? input.url : input.toString();

    if (new URL(requestUrl).pathname === "/api/categories") {
      return createResponse(categoryResponse);
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

  it("renders the service desk card without requesting health initially", () => {
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

  it("shows a disabled checking state while the request is pending", async () => {
    const pendingResponse = createDeferred<Response>();
    mockHealthAndCategories(
      fetchMock,
      async () => await pendingResponse.promise
    );
    renderHomePage();

    const button = screen.getByRole("button", { name: "[ Check System ]" });

    act(() => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText("System Status: Checking...")).toBeTruthy();
      expect(button).toHaveProperty("disabled", true);
    });

    const statusRegion = screen.getByRole("status");
    expect(statusRegion.getAttribute("aria-live")).toBe("polite");
    expect(statusRegion.getAttribute("aria-atomic")).toBe("true");

    act(() => {
      pendingResponse.resolve(createResponse(healthResponse));
    });
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

  it("shows a connection failure message when the API cannot be reached", async () => {
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
    const secondResponse = createDeferred<Response>();
    const healthFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createResponse(healthResponse))
      .mockReturnValueOnce(secondResponse.promise);
    mockHealthAndCategories(fetchMock, healthFetch);
    renderHomePage();

    const button = screen.getByRole("button", { name: "[ Check System ]" });

    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
    });

    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(screen.getByText("System Status: Checking...")).toBeTruthy();
      expect(button).toHaveProperty("disabled", true);
    });

    act(() => {
      secondResponse.resolve(createResponse(healthResponse));
    });
    await waitFor(() => {
      expect(screen.getByText("System Status: Online")).toBeTruthy();
    });
    expect(healthFetch).toHaveBeenCalledTimes(2);
  });
});
