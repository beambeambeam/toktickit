import {
  AddCircleIcon,
  Clock01Icon,
  Ticket01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

import type { AuthUser } from "@/api/auth";
import { Icon } from "@/components/icon";
import { useAuth } from "@/context/auth";

type AppShellProps = PropsWithChildren<{
  allowedRoles?: readonly AuthUser["role"][];
  eyebrow?: string;
  title: string;
}>;

export const AuthLoading = () => (
  <main className="page-content standalone-message">
    <section aria-live="polite" className="surface-card feedback feedback-info">
      <h1>Checking your session…</h1>
      <p>Please wait while TokTickIT restores your signed-in session.</p>
    </section>
  </main>
);

export const AuthRequired = () => {
  const navigate = useNavigate();
  const { authError, isLoading, refetchAuth, user } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    void navigate({
      to: user?.mustChangePassword === true ? "/change-password" : "/login",
    });
  }, [isLoading, navigate, user]);

  if (isLoading) {
    return <AuthLoading />;
  }

  return (
    <main className="page-content standalone-message">
      <section className="surface-card feedback feedback-error" role="alert">
        <h1>Sign in required</h1>
        <p>
          {authError instanceof Error
            ? authError.message
            : "Sign in to open this TokTickIT page."}
        </p>
        <button
          className="button button-secondary"
          onClick={() => void refetchAuth()}
          type="button"
        >
          Retry session check
        </button>
      </section>
    </main>
  );
};

const AccessDeniedMessage = ({ message }: { message: string }) => (
  <main className="page-content standalone-message">
    <section className="surface-card feedback feedback-warning" role="alert">
      <h1>Access denied</h1>
      <p>{message}</p>
      <Link className="button button-secondary" to="/change-password">
        Change Password
      </Link>
    </section>
  </main>
);

export const AccessDenied = () => (
  <AccessDeniedMessage message="Your account role cannot open this page. Use a permitted workspace or change your account with an Administrator." />
);

export const RequesterAccessDenied = () => (
  <AccessDeniedMessage message="This client currently provides the Requester workspace. Your account role cannot open this page." />
);

export const homeRouteForRole = (
  role: AuthUser["role"]
): "/" | "/tickets" | "/staff/tickets" | "/users" => {
  if (role === "Requester") {
    return "/tickets";
  }

  if (role === "Administrator") {
    return "/users";
  }

  return "/staff/tickets";
};

export const AppShell = ({
  allowedRoles,
  children,
  eyebrow,
  title,
}: AppShellProps) => {
  const navigate = useNavigate();
  const { logout, user, isLoading } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (user === null) {
      void navigate({ to: "/login" });
      return;
    }

    if (user.mustChangePassword && title !== "Change Password") {
      void navigate({ to: "/change-password" });
    }
  }, [isLoading, navigate, title, user]);

  if (isLoading || user === null || user.mustChangePassword) {
    return <AuthRequired />;
  }

  const canAccess =
    allowedRoles === undefined
      ? user.role === "Requester"
      : allowedRoles.includes(user.role);

  if (!canAccess && title !== "Change Password") {
    return <AccessDenied />;
  }

  const isQueueReader =
    user.role === "IT Staff" || user.role === "Administrator";

  const handleLogout = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await logout();
      await navigate({ to: "/login" });
    } catch (error: unknown) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Unable to sign out. Try again."
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initial = user.displayName.slice(0, 1).toUpperCase();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link className="brand" to={homeRouteForRole(user.role)}>
            <span aria-hidden="true" className="brand-mark">
              <Icon icon={Clock01Icon} />
            </span>
            <span>TokTickIT</span>
          </Link>
          <nav aria-label="Primary navigation" className="desktop-nav">
            {isQueueReader ? (
              <Link
                activeOptions={{ exact: false }}
                activeProps={{ className: "nav-link active" }}
                className="nav-link"
                to="/staff/tickets"
              >
                <span aria-hidden="true">
                  <Icon icon={Ticket01Icon} />
                </span>{" "}
                Ticket Queue
              </Link>
            ) : null}
            {user.role === "Requester" ? (
              <>
                <Link
                  activeOptions={{ exact: false }}
                  activeProps={{ className: "nav-link active" }}
                  className="nav-link"
                  to="/tickets"
                >
                  <span aria-hidden="true">
                    <Icon icon={Ticket01Icon} />
                  </span>{" "}
                  My Tickets
                </Link>
                <Link
                  activeProps={{ className: "nav-link active" }}
                  className="nav-link"
                  to="/create"
                >
                  <span aria-hidden="true">
                    <Icon icon={AddCircleIcon} />
                  </span>{" "}
                  Create Ticket
                </Link>
              </>
            ) : null}
            {user.role === "Administrator" ? (
              <Link
                activeProps={{ className: "nav-link active" }}
                className="nav-link"
                to="/users"
              >
                <span aria-hidden="true">
                  <Icon icon={UserGroupIcon} />
                </span>{" "}
                User Management
              </Link>
            ) : null}
            <Link
              activeProps={{ className: "nav-link active" }}
              className="nav-link"
              to="/change-password"
            >
              Change Password
            </Link>
          </nav>
          <div className="account-chip">
            <span aria-hidden="true" className="account-avatar">
              {initial}
            </span>
            <span className="account-chip-copy">
              <span className="account-chip-label">Signed in as</span>
              <strong>{user.displayName}</strong>
              <span>{user.role}</span>
            </span>
            {logoutError === null ? null : (
              <span className="logout-error desktop-logout-error" role="alert">
                {logoutError}
              </span>
            )}
            <button
              className="button button-ghost"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              {isLoggingOut ? "Signing out…" : "Log out"}
            </button>
          </div>
          <details className="mobile-nav">
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile navigation">
              {isQueueReader ? (
                <Link to="/staff/tickets">Ticket Queue</Link>
              ) : null}
              {user.role === "Requester" ? (
                <>
                  <Link to="/tickets">My Tickets</Link>
                  <Link to="/create">Create Ticket</Link>
                </>
              ) : null}
              {user.role === "Administrator" ? (
                <Link to="/users">User Management</Link>
              ) : null}
              <Link to="/change-password">Change Password</Link>
              <button
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                type="button"
              >
                {isLoggingOut ? "Signing out…" : "Log out"}
              </button>
              {logoutError === null ? null : (
                <span className="logout-error mobile-logout-error" role="alert">
                  {logoutError}
                </span>
              )}
            </nav>
          </details>
        </div>
      </header>
      <main className="page-content">
        <div className="page-heading">
          <div>
            {eyebrow !== undefined && eyebrow.length > 0 ? (
              <p className="eyebrow">{eyebrow}</p>
            ) : null}
            <h1>{title}</h1>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};
