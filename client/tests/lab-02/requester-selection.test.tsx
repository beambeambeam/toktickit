/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as TanStackRouter from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequesterProvider } from "@/context/requester";
import { RequesterSelectionPage } from "@/routes/index";

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

const activeRequester = {
  displayName: "Ada Requester",
  email: "ada@example.test",
  id: 1,
};

const renderSelection = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RequesterProvider>
        <RequesterSelectionPage />
      </RequesterProvider>
    </QueryClientProvider>
  );
};

describe("Development Requester selection", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ items: [activeRequester] }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads active contexts, excludes inactive data, and navigates after Continue", async () => {
    renderSelection();

    const requesterSelect = await screen.findByRole("combobox", {
      name: /Development Requester/u,
    });
    expect(screen.getByText(/This is for testing only/u)).toBeTruthy();
    expect(
      screen.queryByRole("option", { name: /Inactive Requester/u })
    ).toBeNull();

    await waitFor(() => {
      expect(requesterSelect).not.toHaveProperty("disabled", true);
    });
    expect(screen.getByRole("button", { name: /Continue/u })).toHaveProperty(
      "disabled",
      true
    );

    act(() => {
      fireEvent.change(requesterSelect, { target: { value: "1" } });
    });
    expect(screen.getByRole("button", { name: /Continue/u })).toHaveProperty(
      "disabled",
      false
    );

    fireEvent.click(screen.getByRole("button", { name: /Continue/u }));

    expect(sessionStorage.getItem("toktickit.development-requester")).toContain(
      "Ada Requester"
    );
    expect(navigateMock).toHaveBeenCalledWith({ to: "/tickets" });
  });

  it("shows a recoverable empty state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [] }))
    );
    renderSelection();

    expect(
      await screen.findByText("No active Development Requesters are available.")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
