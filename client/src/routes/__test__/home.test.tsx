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

const createResponse = (body: unknown, status = 200) =>
  Response.json(body, { status });

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
    fetchMock.mockReturnValueOnce(pendingResponse.promise);
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
    fetchMock.mockResolvedValueOnce(createResponse(healthResponse));
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

  it("shows a connection failure message when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
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
    fetchMock.mockResolvedValue(malformedResponse);
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
    fetchMock
      .mockResolvedValueOnce(
        createResponse({ message: "Health service unavailable" }, 500)
      )
      .mockResolvedValueOnce(
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
    fetchMock
      .mockResolvedValueOnce(new Response("Gateway timeout", { status: 500 }))
      .mockResolvedValueOnce(new Response("Gateway timeout", { status: 500 }));
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
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(createResponse(healthResponse));
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("performs another health check after a successful check", async () => {
    const secondResponse = createDeferred<Response>();
    fetchMock
      .mockResolvedValueOnce(createResponse(healthResponse))
      .mockReturnValueOnce(secondResponse.promise);
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
