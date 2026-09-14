/* @vitest-environment jsdom */

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
import { ApiRequestError } from "@/api/errors";
import { ChangePasswordPage } from "@/pages/change-password-page";
import { LandingPage } from "@/pages/landing-page";
import { LoginPage } from "@/pages/login-page";
import { MyTicketsPage } from "@/pages/my-tickets-page";

const {
  authUser,
  authState,
  changePasswordMock,
  loginMock,
  logoutMock,
  navigateMock,
} = vi.hoisted(() => ({
  authState: { user: null as AuthUser | null },
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
  changePasswordMock: vi.fn(),
  loginMock: vi.fn(),
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
    auth:
      authState.user === null
        ? null
        : { csrfToken: "csrf-token", user: authState.user },
    authError: null,
    changePassword: changePasswordMock,
    isLoading: false,
    isRefreshing: false,
    login: loginMock,
    logout: logoutMock,
    refetchAuth: vi.fn(),
    user: authState.user,
  }),
}));

describe("authenticated identity screens", () => {
  beforeEach(() => {
    authState.user = null;
    authUser.mustChangePassword = false;
    changePasswordMock.mockReset();
    loginMock.mockReset();
    logoutMock.mockReset();
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("gives unrestricted IT Staff an account destination with credential and logout controls", () => {
    authState.user = { ...authUser, role: "IT Staff" };
    render(<LandingPage />);
    expect(screen.getByRole("heading", { name: "My Account" })).toBeTruthy();
    expect(screen.getByText(authUser.email)).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: "Change Password" })
    ).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Log out" })).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Access denied" })).toBeNull();
    expect(screen.queryByRole("link", { name: "User Management" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My Tickets" })).toBeNull();
  });

  it("keeps IT Staff at mandatory password change before opening the account destination", async () => {
    authState.user = {
      ...authUser,
      mustChangePassword: true,
      role: "IT Staff",
    };
    render(<LandingPage />);
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/change-password" });
    });
    expect(screen.queryByRole("heading", { name: "My Account" })).toBeNull();
  });

  it("validates required login fields and preserves email on credential failure", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your email address.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(loginMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Email/u), {
      target: { value: "ada@example.test" },
    });
    fireEvent.change(screen.getByLabelText(/Password/u), {
      target: { value: "incorrect password" },
    });
    loginMock.mockRejectedValueOnce(
      new ApiRequestError(
        401,
        "Unable to sign in. Check your credentials or contact your administrator.",
        "INVALID_CREDENTIALS"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(
        "Unable to sign in. Check your credentials or contact your administrator."
      )
    ).toBeTruthy();
    expect(screen.getByLabelText(/Email/u)).toHaveProperty(
      "value",
      "ada@example.test"
    );
  });

  it("supports accessible password visibility and mandatory-password landing", async () => {
    render(<LoginPage />);
    const password = screen.getByLabelText(/Password/u);

    expect(password).toHaveProperty("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText(/Password/u)).toHaveProperty("type", "text");

    loginMock.mockResolvedValueOnce({
      csrfToken: "csrf-token",
      user: { ...authUser, mustChangePassword: true },
    });
    fireEvent.change(screen.getByLabelText(/Email/u), {
      target: { value: "ada@example.test" },
    });
    fireEvent.change(screen.getByLabelText(/Password/u), {
      target: { value: "a valid passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/change-password" });
    });
  });

  it("enforces Unicode password length and sends only a confirmed replacement", async () => {
    authUser.mustChangePassword = true;
    authState.user = authUser;
    render(<ChangePasswordPage />);

    fireEvent.change(screen.getByLabelText(/Current password/u), {
      target: { value: "old passphrase" },
    });
    fireEvent.change(screen.getByLabelText(/New password/u), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm new password/u), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(
      await screen.findByText(
        "New password must contain 15–128 Unicode characters."
      )
    ).toBeTruthy();
    expect(changePasswordMock).not.toHaveBeenCalled();

    const replacement = "new passphrase with spaces";
    fireEvent.change(screen.getByLabelText(/New password/u), {
      target: { value: replacement },
    });
    fireEvent.change(screen.getByLabelText(/Confirm new password/u), {
      target: { value: replacement },
    });
    changePasswordMock.mockResolvedValueOnce({
      csrfToken: "rotated-csrf-token",
      user: { ...authUser, mustChangePassword: false },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith({
        currentPassword: "old passphrase",
        newPassword: replacement,
      });
    });
    expect(screen.getByLabelText(/New password/u)).toHaveProperty("value", "");
  });

  it("explains password-change throttling and disables retrying early", async () => {
    authState.user = authUser;
    render(<ChangePasswordPage />);

    fireEvent.change(screen.getByLabelText(/Current password/u), {
      target: { value: "old passphrase" },
    });
    fireEvent.change(screen.getByLabelText(/New password/u), {
      target: { value: "new passphrase with spaces" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm new password/u), {
      target: { value: "new passphrase with spaces" },
    });
    changePasswordMock.mockRejectedValueOnce(
      new ApiRequestError(
        429,
        "Too many sign-in attempts. Try again later.",
        "RATE_LIMITED",
        undefined,
        30
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));

    expect(
      await screen.findByText(
        "Too many password-change attempts. Try again later."
      )
    ).toBeTruthy();
    expect(screen.getByText("Try again in 30 seconds.")).toBeTruthy();
    expect(screen.getByLabelText(/Current password/u)).toHaveProperty(
      "disabled",
      true
    );
    expect(
      screen.getByRole("button", { name: "Save password" })
    ).toHaveProperty("disabled", true);
  });

  it("denies requester screens to authenticated non-Requester roles", () => {
    authState.user = { ...authUser, role: "IT Staff" };
    render(<MyTicketsPage />);

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Change Password" })).toBeTruthy();
  });
});
