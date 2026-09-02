import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { PropsWithChildren } from "react";

import { useRequester } from "@/context/requester";

type AppShellProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
}>;

export const AppShell = ({ children, eyebrow, title }: AppShellProps) => {
  const navigate = useNavigate();
  const { clearRequester, requester } = useRequester();

  if (requester === null) {
    return null;
  }

  const changeRequester = () => {
    clearRequester();
    void navigate({ to: "/" });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link className="brand" to="/tickets">
            <span aria-hidden="true" className="brand-mark">
              ◷
            </span>
            <span>TokTickIT</span>
          </Link>
          <nav aria-label="Primary navigation" className="desktop-nav">
            <Link
              activeOptions={{ exact: false }}
              activeProps={{ className: "nav-link active" }}
              className="nav-link"
              to="/tickets"
            >
              <span aria-hidden="true">▤</span> My Tickets
            </Link>
            <Link
              activeProps={{ className: "nav-link active" }}
              className="nav-link"
              to="/create"
            >
              <span aria-hidden="true">⊕</span> Create Ticket
            </Link>
          </nav>
          <div className="requester-chip">
            <span aria-hidden="true" className="requester-avatar">
              {requester.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="requester-chip-copy">
              <span className="requester-chip-label">Current requester</span>
              <strong>{requester.displayName}</strong>
            </span>
            <button
              className="button button-ghost"
              onClick={changeRequester}
              type="button"
            >
              Change Requester
            </button>
          </div>
          <details className="mobile-nav">
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile navigation">
              <Link to="/tickets">My Tickets</Link>
              <Link to="/create">Create Ticket</Link>
              <button onClick={changeRequester} type="button">
                Change Requester
              </button>
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

export const RequesterRequired = () => {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/" });
  }, [navigate]);

  return (
    <main className="page-content standalone-message">
      <section className="surface-card feedback feedback-warning">
        <h1>Select a Development Requester</h1>
        <p>
          Choose a Lab 2 testing context before opening requester workflows.
        </p>
      </section>
    </main>
  );
};
