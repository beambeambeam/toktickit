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

import type { AuthUser } from "@/api/auth";
import { UserManagementPage } from "@/pages/user-management-page";

const { authState, createUserMock, getUsersMock, navigateMock } = vi.hoisted(
  () => ({
    authState: { user: null as AuthUser | null },
    createUserMock: vi.fn(),
    getUsersMock: vi.fn(),
    navigateMock: vi.fn(),
  })
);

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

vi.mock("@/api/users", () => ({
  createUser: createUserMock,
  getUsers: getUsersMock,
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    auth:
      authState.user === null
        ? null
        : { csrfToken: "csrf-token", user: authState.user },
    authError: null,
    changePassword: vi.fn(),
    isLoading: false,
    isRefreshing: false,
    login: vi.fn(),
    logout: vi.fn(),
    refetchAuth: vi.fn(),
    user: authState.user,
  }),
}));

const adminUser: AuthUser = {
  createdAt: "2026-09-01T00:00:00.000Z",
  displayName: "Ari Administrator",
  email: "admin@example.test",
  id: 1,
  isActive: true,
  mustChangePassword: false,
  role: "Administrator",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const users = [
  adminUser,
  {
    createdAt: "2026-09-02T00:00:00.000Z",
    displayName: "Ada Requester",
    email: "ada@example.test",
    id: 2,
    isActive: true,
    mustChangePassword: true,
    role: "Requester" as const,
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
];

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UserManagementPage />
    </QueryClientProvider>
  );
};

describe("Administrator user management", () => {
  beforeEach(() => {
    authState.user = adminUser;
    createUserMock.mockReset();
    getUsersMock.mockReset();
    navigateMock.mockReset();
    getUsersMock.mockResolvedValue(users);
  });

  afterEach(() => {
    cleanup();
  });

  it("lists users, shows role/status presentation, and applies search", async () => {
    renderPage();

    const matchingUsers = await screen.findAllByText("Ada Requester");
    expect(matchingUsers.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requester").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("Create User")).toBeTruthy();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search name or email" }),
      {
        target: { value: "ada" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(getUsersMock).toHaveBeenLastCalledWith(
        { search: "ada" },
        expect.anything()
      );
    });
  });

  it("rejects an overlong search before requesting the API", async () => {
    renderPage();
    await screen.findAllByText("Ada Requester");

    const search = screen.getByRole("searchbox", {
      name: "Search name or email",
    });
    const callsBeforeSearch = getUsersMock.mock.calls.length;
    fireEvent.change(search, { target: { value: "😀".repeat(201) } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByText(
        "Search must contain at most 200 Unicode characters."
      )
    ).toBeTruthy();
    expect(document.activeElement).toBe(search);
    expect(getUsersMock).toHaveBeenCalledTimes(callsBeforeSearch);
  });

  it("validates and creates an account without redisplaying its password", async () => {
    renderPage();
    await screen.findAllByText("Ada Requester");
    fireEvent.click(screen.getByRole("button", { name: "Create User" }));

    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    expect(await screen.findByText(/Name must contain 1–100/u)).toBeTruthy();
    expect(createUserMock).not.toHaveBeenCalled();

    const initialPassword = "initial passphrase";
    fireEvent.change(screen.getByLabelText(/Name/u), {
      target: { value: "Ben Requester" },
    });
    fireEvent.change(screen.getByLabelText(/Email/u), {
      target: { value: "ben@example.test" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "Requester" },
    });
    fireEvent.change(screen.getByLabelText(/Initial password/u), {
      target: { value: initialPassword },
    });
    createUserMock.mockResolvedValueOnce({
      ...users[1],
      displayName: "Ben Requester",
      email: "ben@example.test",
      id: 3,
    });

    fireEvent.click(screen.getByRole("button", { name: "Save User" }));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        displayName: "Ben Requester",
        email: "ben@example.test",
        initialPassword,
        isActive: true,
        role: "Requester",
      });
    });
    expect(await screen.findByText(/Ben Requester was created/u)).toBeTruthy();
    expect(screen.getByLabelText(/Initial password/u)).toHaveProperty(
      "value",
      ""
    );
    expect(screen.queryByText(initialPassword)).toBeNull();
  });

  it("does not fetch or expose the management screen to non-Administrators", () => {
    authState.user = { ...adminUser, role: "IT Staff" };
    renderPage();

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeTruthy();
    expect(getUsersMock).not.toHaveBeenCalled();
  });
});
