import { RefreshIcon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { staffDashboardQueryOptions } from "@/api/dashboard-query-options";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { MyActionListItem } from "@/components/my-action-list-item";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/context/auth";
import type { StaffDashboardTicketPreview } from "@/generated/hey-api/types.gen";
import { formatBangkokDate } from "@/lib/action-format";
import { buildLoadFailureCopy, loadFailureKind } from "@/lib/load-failure";
import { isStaffRole, STAFF_ROLES } from "@/lib/staff-roles";

const TICKET_STATUSES = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Reopened",
  "Resolved",
  "Closed",
  "Cancelled",
] as const;

const IT_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

type QueueSearch =
  | { currentStatus: (typeof TICKET_STATUSES)[number] }
  | { itPriority: (typeof IT_PRIORITIES)[number]; scope: "active" }
  | { owner: "me" | "unassigned"; scope: "active" };

const MetricCard = ({
  count,
  label,
  search,
}: {
  count: number;
  label: string;
  search: QueueSearch;
}) => (
  <article className="surface-card dashboard-metric-card">
    <Link
      aria-label={`${label}: ${count}`}
      className="dashboard-metric-link"
      search={search}
      to="/staff/tickets"
    >
      <span className="dashboard-metric-label">{label}</span>
      <span className="dashboard-metric-count" aria-hidden="true">
        {count}
      </span>
      <span className="dashboard-metric-hint">View matching Tickets</span>
    </Link>
  </article>
);

type TicketPreviewSearch =
  | { from: string; scope: "recently-updated"; through: string }
  | { scope: "urgent-active" };

const StaffTicketPreviewRow = ({
  ticket,
}: {
  ticket: StaffDashboardTicketPreview;
}) => (
  <li className="dashboard-preview-item">
    <div className="dashboard-preview-heading">
      <Link
        className="dashboard-ticket-link"
        params={{ ticketId: ticket.id.toString() }}
        to="/tickets/$ticketId"
      >
        <span className="ticket-number">{ticket.ticketNumber}</span>
        <span className="dashboard-preview-summary">{ticket.summary}</span>
      </Link>
      <div className="badge-group">
        <StatusBadge kind="status" value={ticket.currentStatus} />
        <StatusBadge kind="priority" value={ticket.itPriority} />
        <StatusBadge
          kind="owner"
          value={ticket.owner?.displayName ?? "Unassigned"}
        />
      </div>
    </div>
    <p className="dashboard-preview-date">
      Updated {formatBangkokDate(ticket.updatedAt)}
    </p>
  </li>
);

const TicketPreviewSection = ({
  emptyMessage,
  headingId,
  items,
  search,
  title,
}: {
  emptyMessage: string;
  headingId: string;
  items: StaffDashboardTicketPreview[];
  search: TicketPreviewSearch;
  title: string;
}) => (
  <section
    aria-labelledby={headingId}
    className="surface-card dashboard-preview-card"
  >
    <div className="dashboard-section-heading">
      <h2 id={headingId}>{title}</h2>
      <Link className="text-link" search={search} to="/staff/tickets">
        View all
      </Link>
    </div>
    {items.length === 0 ? (
      <div className="dashboard-empty-preview">
        <p>{emptyMessage}</p>
        <Link search={search} to="/staff/tickets">
          Ticket Queue
        </Link>
      </div>
    ) : (
      <ul className="dashboard-preview-list">
        {items.map((ticket) => (
          <StaffTicketPreviewRow key={ticket.id} ticket={ticket} />
        ))}
      </ul>
    )}
  </section>
);

const FAILURE_COPY = buildLoadFailureCopy({
  forbiddenBody: "You do not have permission to view this dashboard.",
  genericBody:
    "Could not load your dashboard. Check your connection and try again.",
  genericHeading: "Dashboard could not be loaded",
  sessionBody: "Sign in again to view your dashboard.",
});

export const StaffDashboardPage = () => {
  const { user } = useAuth();
  const canViewDashboard = user !== null && isStaffRole(user.role);
  const dashboardQuery = useQuery({
    ...staffDashboardQueryOptions(user?.id ?? 0, user?.role ?? "IT Staff"),
    enabled: canViewDashboard,
  });
  const dashboard = dashboardQuery.isError ? undefined : dashboardQuery.data;
  const failure = dashboardQuery.isError
    ? loadFailureKind(dashboardQuery.error)
    : null;
  const windowNoteRef = useRef<HTMLParagraphElement>(null);
  const focusAfterRetry = useRef(false);
  useEffect(() => {
    if (dashboard !== undefined && focusAfterRetry.current) {
      focusAfterRetry.current = false;
      windowNoteRef.current?.focus();
    }
  }, [dashboard]);

  return (
    <AppShell
      allowedRoles={STAFF_ROLES}
      eyebrow="Staff workspace"
      title="Dashboard"
    >
      <div className="page-actions dashboard-actions">
        <p className="page-description">
          Ticket counts, your pending Actions, and Tickets that need attention.
        </p>
        <button
          aria-disabled={dashboardQuery.isFetching}
          aria-label="Refresh dashboard"
          className="button button-secondary"
          onClick={() => {
            if (!dashboardQuery.isFetching) {
              void dashboardQuery.refetch();
            }
          }}
          type="button"
        >
          <Icon icon={RefreshIcon} />
          {dashboardQuery.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {dashboardQuery.isPending ? (
        <p aria-live="polite" className="loading-line" role="status">
          Loading your dashboard…
        </p>
      ) : null}

      {failure === null ? null : (
        <section className="surface-card feedback feedback-error" role="alert">
          <h2>{FAILURE_COPY[failure].heading}</h2>
          <p>{FAILURE_COPY[failure].body}</p>
          {failure === "generic" ? (
            <button
              aria-disabled={dashboardQuery.isFetching}
              className="button button-secondary"
              onClick={() => {
                if (!dashboardQuery.isFetching) {
                  focusAfterRetry.current = true;
                  void dashboardQuery.refetch();
                }
              }}
              type="button"
            >
              Retry dashboard
            </button>
          ) : null}
        </section>
      )}

      <p aria-live="polite" className="visually-hidden" role="status">
        {dashboard === undefined
          ? ""
          : `Dashboard updated ${formatBangkokDate(dashboard.generatedAt)}`}
      </p>

      {dashboard === undefined ? null : (
        <>
          <p className="dashboard-window" ref={windowNoteRef} tabIndex={-1}>
            Updated {formatBangkokDate(dashboard.generatedAt)}. Recently updated
            Tickets cover {formatBangkokDate(dashboard.window.from)} through{" "}
            {formatBangkokDate(dashboard.window.through)}.
          </p>
          <section
            aria-label="Ticket metrics"
            className="dashboard-metrics-grid"
          >
            <MetricCard
              count={dashboard.counts.activeUnassigned}
              label="Active Unassigned"
              search={{ owner: "unassigned", scope: "active" }}
            />
            <MetricCard
              count={dashboard.counts.activeOwned}
              label="Active Owned"
              search={{ owner: "me", scope: "active" }}
            />
            {TICKET_STATUSES.map((status) => (
              <MetricCard
                count={dashboard.counts.byStatus[status]}
                key={status}
                label={status}
                search={{ currentStatus: status }}
              />
            ))}
            {IT_PRIORITIES.map((priority) => (
              <MetricCard
                count={dashboard.counts.activeByPriority[priority]}
                key={priority}
                label={`Active ${priority}`}
                search={{ itPriority: priority, scope: "active" }}
              />
            ))}
            <article className="surface-card dashboard-metric-card">
              <Link
                aria-label={`My Actions: ${dashboard.counts.myActions}`}
                className="dashboard-metric-link"
                to="/staff/actions"
              >
                <span className="dashboard-metric-label">My Actions</span>
                <span className="dashboard-metric-count" aria-hidden="true">
                  {dashboard.counts.myActions}
                </span>
                <span className="dashboard-metric-hint">
                  Open your pending actions
                </span>
              </Link>
            </article>
          </section>
          <div className="dashboard-preview-grid">
            <section
              aria-labelledby="dashboard-my-actions-heading"
              className="surface-card dashboard-preview-card"
            >
              <div className="dashboard-section-heading">
                <h2 id="dashboard-my-actions-heading">My Actions</h2>
                <Link className="text-link" to="/staff/actions">
                  View all
                </Link>
              </div>
              {dashboard.previews.myActions.length === 0 ? (
                <div className="dashboard-empty-preview">
                  <p>
                    No Planned or In Progress actions are assigned to you on
                    active Tickets.
                  </p>
                  <Link to="/staff/actions">My Actions</Link>
                </div>
              ) : (
                <ul className="dashboard-preview-list">
                  {dashboard.previews.myActions.map((action) => (
                    <MyActionListItem action={action} compact key={action.id} />
                  ))}
                </ul>
              )}
            </section>
            <TicketPreviewSection
              emptyMessage="No Tickets were updated in this 7-day window."
              headingId="dashboard-recently-updated-heading"
              items={dashboard.previews.recentlyUpdatedTickets}
              search={{
                from: dashboard.window.from,
                scope: "recently-updated",
                through: dashboard.window.through,
              }}
              title="Recently Updated"
            />
            <TicketPreviewSection
              emptyMessage="No active Urgent Tickets right now."
              headingId="dashboard-urgent-active-heading"
              items={dashboard.previews.urgentActiveTickets}
              search={{ scope: "urgent-active" }}
              title="Urgent Active"
            />
          </div>
        </>
      )}
    </AppShell>
  );
};
