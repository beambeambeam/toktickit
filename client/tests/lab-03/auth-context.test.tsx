/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthResponse } from "@/api/auth";
import { AuthProvider, useAuth } from "@/context/auth";

const { getCurrentAuthMock } = vi.hoisted(() => ({
  getCurrentAuthMock: vi.fn(),
}));

vi.mock("@/api/auth", () => ({
  changePassword: vi.fn(),
  getCurrentAuth: getCurrentAuthMock,
  login: vi.fn(),
  logout: vi.fn(),
}));

const createAuthResponse = (id: number): AuthResponse => ({
  csrfToken: `csrf-${id}`,
  user: {
    createdAt: "2026-09-01T00:00:00.000Z",
    displayName: `Requester ${id}`,
    email: `requester-${id}@example.test`,
    id,
    isActive: true,
    mustChangePassword: false,
    role: "Requester",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
});

const AuthProbe = () => {
  const { refetchAuth, user } = useAuth();

  return (
    <>
      <span data-testid="identity">{user?.id ?? "signed-out"}</span>
      <button onClick={() => void refetchAuth()} type="button">
        Refresh auth
      </button>
    </>
  );
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 60_000,
        retry: false,
      },
    },
  });

describe("authentication context identity boundaries", () => {
  beforeEach(() => {
    getCurrentAuthMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("clears private query data when a refreshed principal changes", async () => {
    getCurrentAuthMock
      .mockResolvedValueOnce(createAuthResponse(1))
      .mockResolvedValueOnce(createAuthResponse(2));
    const queryClient = createQueryClient();
    queryClient.setQueryData(["tickets", "mine"], { ticketNumber: "TKT-1" });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("identity").textContent).toBe("1");
    });
    expect(queryClient.getQueryData(["tickets", "mine"])).toEqual({
      ticketNumber: "TKT-1",
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh auth" }));

    await waitFor(() => {
      expect(screen.getByTestId("identity").textContent).toBe("2");
      expect(queryClient.getQueryData(["tickets", "mine"])).toBeUndefined();
    });
  });
});
