/* @vitest-environment jsdom */

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { healthQueryOptions } from "@/api/health";

const healthResponse = {
  service: "TokTickIT API",
  status: "ok",
} as const;

const createResponse = (body: unknown, status = 200) =>
  Response.json(body, { status });

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        notifyOnChangeProps: "all",
        retryDelay: 0,
      },
    },
  });

  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe("health query", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not request health on initial render", () => {
    const { result } = renderHook(() => useQuery(healthQueryOptions()), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns health data after an explicit refetch", async () => {
    fetchMock.mockResolvedValueOnce(createResponse(healthResponse));

    const { result } = renderHook(() => useQuery(healthQueryOptions()), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(healthResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) {
      throw new TypeError("Expected the API request to be a Request");
    }
    expect(request.url).toBe("http://localhost:3000/api/health");
  });

  it("preserves an API error message", async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({ message: "Health service unavailable" }, 500)
    );

    const { result } = renderHook(
      () => useQuery({ ...healthQueryOptions(), retry: false }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    const { error } = result.current;
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) {
      throw new TypeError("Expected the health error to be an Error");
    }
    expect(error.message).toBe("Health service unavailable");
  });

  it("preserves connection failures without an API message", async () => {
    const connectionError = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValueOnce(connectionError);

    const { result } = renderHook(
      () => useQuery({ ...healthQueryOptions(), retry: false }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBe(connectionError);
  });

  it("keeps non-JSON error details available", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Gateway timeout", { status: 500 })
    );

    const { result } = renderHook(
      () => useQuery({ ...healthQueryOptions(), retry: false }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    const { error } = result.current;
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) {
      throw new TypeError("Expected the health error to be an Error");
    }
    expect(error.message).toBe("Gateway timeout");
  });

  it("retries a failed request", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Temporary connection failure"))
      .mockResolvedValueOnce(createResponse(healthResponse));

    const { result } = renderHook(() => useQuery(healthQueryOptions()), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(healthResponse);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
