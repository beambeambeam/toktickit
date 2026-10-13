import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Ticket01Icon,
} from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { ApiRequestError } from "@/api/errors";
import type {
  StaffMyActionsPageSize,
  StaffMyActionsParams,
} from "@/api/staff-actions";
import { staffMyActionsQueryOptions } from "@/api/staff-actions-query-options";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/context/auth";
import type { MyActionRow } from "@/generated/hey-api/types.gen";
import { formatBangkokDate } from "@/lib/action-format";
import { getPageTokens } from "@/lib/pagination";

const PAGE_SIZES: readonly StaffMyActionsPageSize[] = [10, 20, 50];

const parsePageSize = (value: string): StaffMyActionsPageSize =>
  PAGE_SIZES.find((pageSize) => String(pageSize) === value) ?? 20;

const MyActionListItem = ({ action }: { action: MyActionRow }) => (
  <li className="dashboard-preview-item">
    <div className="dashboard-preview-heading">
      <Link
        className="dashboard-ticket-link"
        hash={`action-${action.id}`}
        params={{ ticketId: action.ticketId.toString() }}
        to="/tickets/$ticketId"
      >
        <span className="dashboard-preview-summary">{action.description}</span>
        <span className="ticket-number">{action.ticket.ticketNumber}</span>
        <span className="dashboard-preview-ticket">
          {action.ticket.summary}
        </span>
      </Link>
      <div className="badge-group">
        <StatusBadge kind="status" value={action.ticket.currentStatus} />
        <StatusBadge kind="owner" value={action.assignee.displayName} />
      </div>
    </div>
    <p className="dashboard-preview-date">
      Action {action.status}. Updated {formatBangkokDate(action.updatedAt)}
    </p>
  </li>
);

type MyActionsFailure = "forbidden" | "generic" | "session";

const failureKind = (error: unknown): MyActionsFailure => {
  if (error instanceof ApiRequestError && error.status === 401) {
    return "session";
  }
  if (error instanceof ApiRequestError && error.status === 403) {
    return "forbidden";
  }
  return "generic";
};

const FAILURE_COPY = {
  forbidden: {
    body: "You do not have permission to view My Actions.",
    heading: "Access denied",
  },
  generic: {
    body: "Could not load your actions. Check your connection and try again.",
    heading: "My Actions could not be loaded",
  },
  session: {
    body: "Sign in again to view your actions.",
    heading: "Your session has ended",
  },
} as const;

export const StaffMyActionsPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useState<StaffMyActionsParams>({
    page: 1,
    pageSize: 20,
  });
  const actionsQuery = useQuery({
    ...staffMyActionsQueryOptions(
      user?.id ?? 0,
      user?.role ?? "IT Staff",
      params
    ),
    enabled:
      user !== null &&
      (user.role === "IT Staff" || user.role === "Administrator"),
  });
  // A failed refetch must not leave the previous page looking current.
  const data = actionsQuery.isError ? undefined : actionsQuery.data;
  const failure = actionsQuery.isError ? failureKind(actionsQuery.error) : null;

  return (
    <AppShell
      allowedRoles={["IT Staff", "Administrator"]}
      eyebrow="Staff workspace"
      title="My Actions"
    >
      <p className="page-description">
        Planned and In Progress actions assigned to you on active Tickets.
      </p>
      <div className="filter-field">
        <label htmlFor="staff-my-actions-page-size">Per page</label>
        <select
          id="staff-my-actions-page-size"
          onChange={(event) => {
            setParams({
              page: 1,
              pageSize: parsePageSize(event.target.value),
            });
          }}
          value={params.pageSize}
        >
          {PAGE_SIZES.map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </div>
      {actionsQuery.isPending ? (
        <p aria-live="polite" className="loading-line" role="status">
          Loading your actions…
        </p>
      ) : null}
      {failure === null ? null : (
        <section className="surface-card feedback feedback-error" role="alert">
          <h2>{FAILURE_COPY[failure].heading}</h2>
          <p>{FAILURE_COPY[failure].body}</p>
          {failure === "generic" ? (
            <button
              aria-disabled={actionsQuery.isFetching}
              className="button button-secondary"
              onClick={() => {
                if (!actionsQuery.isFetching) {
                  void actionsQuery.refetch();
                }
              }}
              type="button"
            >
              Retry My Actions
            </button>
          ) : null}
        </section>
      )}
      {data !== undefined && data.items.length === 0 ? (
        <div className="empty-state">
          <div aria-hidden="true" className="empty-icon">
            <Icon icon={Ticket01Icon} />
          </div>
          <h3>No assigned actions</h3>
          <p>
            No Planned or In Progress actions are assigned to you on active
            Tickets.
          </p>
        </div>
      ) : null}
      {data !== undefined && data.items.length > 0 ? (
        <section
          aria-label="My Actions"
          className="surface-card dashboard-preview-card"
        >
          <ul className="dashboard-preview-list">
            {data.items.map((action) => (
              <MyActionListItem action={action} key={action.id} />
            ))}
          </ul>
        </section>
      ) : null}
      {data === undefined || data.totalPages === 0 ? null : (
        <nav aria-label="My Actions pages" className="pagination">
          <button
            className="button button-secondary"
            disabled={data.page <= 1}
            onClick={() => {
              setParams((current) => ({ ...current, page: current.page - 1 }));
            }}
            type="button"
          >
            <Icon icon={ArrowLeft01Icon} /> Previous
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <div className="pagination-pages">
            {getPageTokens(data.totalPages, data.page).map((pageToken) =>
              typeof pageToken === "number" ? (
                <button
                  aria-current={pageToken === data.page ? "page" : undefined}
                  aria-label={`Go to page ${pageToken}`}
                  className="button button-secondary pagination-page"
                  key={pageToken}
                  onClick={() => {
                    setParams((current) => ({ ...current, page: pageToken }));
                  }}
                  type="button"
                >
                  {pageToken}
                </button>
              ) : (
                <span
                  aria-hidden="true"
                  className="pagination-ellipsis"
                  key={pageToken}
                >
                  …
                </span>
              )
            )}
          </div>
          <button
            className="button button-secondary"
            disabled={data.page >= data.totalPages}
            onClick={() => {
              setParams((current) => ({ ...current, page: current.page + 1 }));
            }}
            type="button"
          >
            Next <Icon icon={ArrowRight01Icon} />
          </button>
        </nav>
      )}
    </AppShell>
  );
};
