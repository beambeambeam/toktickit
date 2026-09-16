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

import type { AuthUser } from "@/api/auth";
import { ApiRequestError } from "@/api/errors";
import { UserManagementPage } from "@/pages/user-management-page";

const {
  authState,
  createUserMock,
  getUserMock,
  getUsersMock,
  navigateMock,
  resetUserInitialPasswordMock,
  refetchAuthMock,
  updateUserMock,
} = vi.hoisted(() => ({
  authState: { user: null as AuthUser | null },
  createUserMock: vi.fn(),
  getUserMock: vi.fn(),
  getUsersMock: vi.fn(),
  navigateMock: vi.fn(),
  refetchAuthMock: vi.fn(),
  resetUserInitialPasswordMock: vi.fn(),
  updateUserMock: vi.fn(),
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

vi.mock("@/api/users", () => ({
  createUser: createUserMock,
  getUser: getUserMock,
  getUsers: getUsersMock,
  resetUserInitialPassword: resetUserInitialPasswordMock,
  updateUser: updateUserMock,
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
    refetchAuth: refetchAuthMock,
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
      queries: { gcTime: 0, retry: false, retryDelay: 0 },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <UserManagementPage />
    </QueryClientProvider>
  );
  return { ...result, queryClient };
};

const fillCreateForm = async () => {
  await screen.findAllByText("Ada Requester");
  fireEvent.click(screen.getByRole("button", { name: "Create User" }));
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
    target: { value: "initial passphrase" },
  });
};

describe("Administrator user management", () => {
  beforeEach(() => {
    authState.user = adminUser;
    createUserMock.mockReset();
    getUserMock.mockReset();
    getUsersMock.mockReset();
    navigateMock.mockReset();
    resetUserInitialPasswordMock.mockReset();
    refetchAuthMock.mockReset();
    updateUserMock.mockReset();
    getUsersMock.mockResolvedValue(users);
    getUserMock.mockResolvedValue(users[1]);
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

  it("edits an account and performs a separate confirmed initial-password reset", async () => {
    renderPage();
    await screen.findAllByText("Ada Requester");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit Ada Requester" })[0]
    );
    expect(await screen.findByDisplayValue("Ada Requester")).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("Ada Requester"), {
      target: { value: "Ada Updated" },
    });
    updateUserMock.mockResolvedValueOnce({
      ...users[1],
      displayName: "Ada Updated",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith(2, {
        displayName: "Ada Updated",
        email: "ada@example.test",
        isActive: true,
        role: "Requester",
      });
    });
    expect(
      await screen.findByText("Ada Updated was updated successfully.")
    ).toBeTruthy();

    const resetPassword = "replacement initial password";
    fireEvent.change(screen.getByLabelText(/^New initial password/u), {
      target: { value: resetPassword },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I understand that all sessions will end.",
      })
    );
    resetUserInitialPasswordMock.mockResolvedValueOnce({
      ...users[1],
      displayName: "Ada Updated",
      mustChangePassword: true,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Initial Password" })
    );

    await waitFor(() => {
      expect(resetUserInitialPasswordMock).toHaveBeenCalledWith(2, {
        confirmed: true,
        initialPassword: resetPassword,
      });
    });
    expect(
      await screen.findByText(/Ada Updated's initial password was reset/u)
    ).toBeTruthy();
    expect(screen.getByLabelText(/^New initial password/u)).toHaveProperty(
      "value",
      ""
    );
    expect(screen.queryByText(resetPassword)).toBeNull();
  });

  it("initializes the edit form from the fetched account detail", async () => {
    getUserMock.mockResolvedValueOnce({
      ...users[1],
      displayName: "Fresh Ada Detail",
      email: "fresh-ada@example.test",
      isActive: false,
      role: "IT Staff",
    });
    renderPage();
    await screen.findAllByText("Ada Requester");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit Ada Requester" })[0]
    );

    expect(await screen.findByDisplayValue("Fresh Ada Detail")).toBeTruthy();
    expect(screen.getByDisplayValue("fresh-ada@example.test")).toBeTruthy();
    expect(screen.getByDisplayValue("IT Staff")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Active account" })
    ).toHaveProperty("checked", false);
  });

  it("keeps edit values after a duplicate email conflict", async () => {
    resetUserInitialPasswordMock.mockReset();
    updateUserMock.mockRejectedValueOnce(
      new ApiRequestError(409, "Duplicate email", "EMAIL_CONFLICT")
    );
    renderPage();
    await screen.findAllByText("Ada Requester");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit Ada Requester" })[0]
    );
    await screen.findByDisplayValue("Ada Requester");
    fireEvent.change(screen.getByDisplayValue("Ada Requester"), {
      target: { value: "Ada Kept" },
    });
    fireEvent.change(screen.getByDisplayValue("ada@example.test"), {
      target: { value: "duplicate@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByText(
        "That email address is already in use. Enter a unique email address."
      )
    ).toBeTruthy();
    expect(screen.getByDisplayValue("Ada Kept")).toHaveProperty(
      "value",
      "Ada Kept"
    );
    expect(screen.getByDisplayValue("duplicate@example.test")).toHaveProperty(
      "value",
      "duplicate@example.test"
    );
  });

  it("forces login after a self-demotion or self-reset", async () => {
    getUserMock.mockResolvedValueOnce(adminUser);
    updateUserMock.mockResolvedValueOnce({ ...adminUser, role: "IT Staff" });
    renderPage();
    await screen.findAllByText("Ada Requester");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit Ari Administrator" })[0]
    );
    await screen.findByDisplayValue("Ari Administrator");
    fireEvent.change(screen.getByDisplayValue("Administrator"), {
      target: { value: "IT Staff" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        replace: true,
        to: "/login",
      });
    });
    expect(refetchAuthMock).toHaveBeenCalledTimes(1);
  });

  it("does not fetch or expose the management screen to non-Administrators", () => {
    authState.user = { ...adminUser, role: "IT Staff" };
    renderPage();

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeTruthy();
    expect(getUsersMock).not.toHaveBeenCalled();
  });

  it("preserves every form value on duplicate email without revealing the password", async () => {
    createUserMock.mockRejectedValueOnce(
      new ApiRequestError(409, "Duplicate email", "EMAIL_CONFLICT")
    );
    renderPage();
    await fillCreateForm();
    fireEvent.click(screen.getByRole("checkbox", { name: "Active account" }));
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    expect(
      await screen.findByText(
        "That email address is already in use. Enter a unique email address."
      )
    ).toBeTruthy();
    expect(screen.getByLabelText(/Name/u)).toHaveProperty(
      "value",
      "Ben Requester"
    );
    expect(screen.getByLabelText(/Email/u)).toHaveProperty(
      "value",
      "ben@example.test"
    );
    expect(screen.getAllByRole("combobox")[1]).toHaveProperty(
      "value",
      "Requester"
    );
    expect(
      screen.getByRole("checkbox", { name: "Active account" })
    ).toHaveProperty("checked", false);
    expect(screen.getByLabelText(/Initial password/u)).toHaveProperty(
      "value",
      "initial passphrase"
    );
    expect(screen.getByLabelText(/Initial password/u)).toHaveProperty(
      "type",
      "password"
    );
    expect(screen.queryByText("initial passphrase")).toBeNull();
    expect(screen.getByRole("button", { name: "Save User" })).toHaveProperty(
      "disabled",
      false
    );
  });

  it("distinguishes an empty directory from filtered no-results and clears filters", async () => {
    getUsersMock.mockResolvedValue([]);
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "No user accounts yet" })
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Create User" })).toHaveLength(
      2
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "missing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(
      await screen.findByRole("heading", { name: "No matching users" })
    ).toBeTruthy();
    expect(screen.queryByText("No user accounts yet")).toBeNull();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear Filters" })[1]
    );
    expect(
      await screen.findByRole("heading", { name: "No user accounts yet" })
    ).toBeTruthy();
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "");
    expect(getUsersMock).toHaveBeenLastCalledWith({}, expect.anything());
  });

  it("shows load failure and recovers through Retry", async () => {
    getUsersMock.mockRejectedValue(new Error("Service unavailable"));
    renderPage();
    expect(
      await screen.findByText("Unable to load users.", {}, { timeout: 3000 })
    ).toBeTruthy();
    getUsersMock.mockResolvedValue(users);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const matchingUsers = await screen.findAllByText("Ada Requester");
    expect(matchingUsers.length).toBeGreaterThan(0);
    expect(screen.queryByText("Unable to load users.")).toBeNull();
  });

  it("shows loading while the directory request is pending", async () => {
    let resolveUsers!: (value: typeof users) => void;
    getUsersMock.mockReturnValueOnce(
      // oxlint-disable-next-line promise/avoid-new -- control pending network state explicitly.
      new Promise<typeof users>((resolve) => {
        resolveUsers = resolve;
      })
    );
    renderPage();
    expect(screen.getByText("Loading users…")).toBeTruthy();
    act(() => {
      resolveUsers(users);
    });
    const matchingUsers = await screen.findAllByText("Ada Requester");
    expect(matchingUsers.length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading users…")).toBeNull();
  });

  it("disables form controls during saving and clears the password after success", async () => {
    let resolveCreate!: (value: typeof adminUser) => void;
    createUserMock.mockReturnValueOnce(
      // oxlint-disable-next-line promise/avoid-new -- control pending network state explicitly.
      new Promise<typeof adminUser>((resolve) => {
        resolveCreate = resolve;
      })
    );
    renderPage();
    await fillCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    expect(await screen.findByText("Saving user account…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Saving…" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByLabelText(/Initial password/u)).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByLabelText(/Name/u)).toHaveProperty("disabled", true);
    expect(screen.getByLabelText(/Email/u)).toHaveProperty("disabled", true);
    expect(screen.getAllByRole("combobox")[1]).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("checkbox", { name: "Active account" })
    ).toHaveProperty("disabled", true);
    expect(createUserMock).toHaveBeenCalledTimes(1);
    act(() => {
      resolveCreate({ ...adminUser, displayName: "Ben Requester" });
    });
    expect(await screen.findByText(/Ben Requester was created/u)).toBeTruthy();
    expect(screen.getByLabelText(/Initial password/u)).toHaveProperty(
      "value",
      ""
    );
    expect(screen.queryByText("initial passphrase")).toBeNull();
  });

  it.each(["list", "create"])(
    "shows denial and clears all user caches after a %s API 403",
    async (source) => {
      const error = new ApiRequestError(403, "Access forbidden", "FORBIDDEN");
      if (source === "list") {
        getUsersMock.mockRejectedValueOnce(error);
      } else {
        createUserMock.mockRejectedValueOnce(error);
      }
      const { queryClient } = renderPage();
      queryClient.setQueryData(["users", { search: "cached" }], users);
      if (source === "create") {
        await fillCreateForm();
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));
      }
      expect(
        await screen.findByRole("heading", { name: "Access denied" })
      ).toBeTruthy();
      await waitFor(() => {
        expect(queryClient.getQueriesData({ queryKey: ["users"] })).toEqual([]);
      });
      expect(refetchAuthMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
      expect(screen.queryByText("Ada Requester")).toBeNull();
      expect(screen.queryByLabelText(/Initial password/u)).toBeNull();
    }
  );

  it.each(["list", "create"])(
    "redirects a %s password-required response without offering Retry",
    async (source) => {
      const error = new ApiRequestError(
        403,
        "Change password",
        "PASSWORD_CHANGE_REQUIRED"
      );
      if (source === "list") {
        getUsersMock.mockRejectedValueOnce(error);
      } else {
        createUserMock.mockRejectedValueOnce(error);
      }
      const { queryClient } = renderPage();
      if (source === "create") {
        await fillCreateForm();
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));
      }
      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith({
          replace: true,
          to: "/change-password",
        });
      });
      expect(refetchAuthMock).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueriesData({ queryKey: ["users"] })).toEqual([]);
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    }
  );
});
