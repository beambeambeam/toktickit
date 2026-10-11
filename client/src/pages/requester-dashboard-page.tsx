import { RefreshIcon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { requesterDashboardQueryOptions } from "@/api/dashboard-query-options";
import { ApiRequestError } from "@/api/errors";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/context/auth";
import type { RequesterTicketPreview } from "@/generated/hey-api/types.gen";
import { formatBangkokDate } from "@/lib/action-format";

const TicketPreviewRow = ({
  ticket,
  dateLabel,
  dateValue,
}: {
  dateLabel: string;
  dateValue: string;
  ticket: RequesterTicketPreview;
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
        <StatusBadge kind="priority" value={ticket.requestedPriority} />
      </div>
    </div>
    <p className="dashboard-preview-date">
      {dateLabel} {formatBangkokDate(dateValue)}
    </p>
  </li>
);

const DashboardCard = ({
  count,
  label,
  scope,
  from,
  through,
}: {
  count: number;
  from?: string;
  label: string;
  scope:
    | "active"
    | "waiting-for-requester"
    | "recently-updated"
    | "recently-resolved";
  through?: string;
}) => (
  <article className="surface-card dashboard-metric-card">
    <Link
      aria-label={`${label}: ${count}`}
      className="dashboard-metric-link"
      search={{ from, scope, through }}
      to="/tickets"
    >
      <span className="dashboard-metric-label">{label}</span>
      <span className="dashboard-metric-count" aria-hidden="true">
        {count}
      </span>
      <span className="dashboard-metric-hint">View matching Tickets</span>
    </Link>
  </article>
);

const TicketPreviewSection = ({
  emptyMessage,
  items,
  title,
  dateLabel,
  resolved,
  emptyScope,
  from,
  through,
}: {
  dateLabel: string;
  emptyMessage: string;
  emptyScope: "recently-updated" | "recently-resolved";
  from: string;
  items: RequesterTicketPreview[];
  resolved: boolean;
  through: string;
  title: string;
}) => (
  <section
    aria-labelledby={`dashboard-${emptyScope}-heading`}
    className="surface-card dashboard-preview-card"
  >
    <div className="dashboard-section-heading">
      <h2 id={`dashboard-${emptyScope}-heading`}>{title}</h2>
      <Link
        className="text-link"
        search={{ from, scope: emptyScope, through }}
        to="/tickets"
      >
        View all
      </Link>
    </div>
    {items.length === 0 ? (
      <div className="dashboard-empty-preview">
        <p>{emptyMessage}</p>
        <Link search={{ from, scope: emptyScope, through }} to="/tickets">
          My Tickets
        </Link>
      </div>
    ) : (
      <ul className="dashboard-preview-list">
        {items.map((ticket) => (
          <TicketPreviewRow
            dateLabel={dateLabel}
            dateValue={
              resolved
                ? (ticket.resolvedAt ?? ticket.updatedAt)
                : ticket.updatedAt
            }
            key={ticket.id}
            ticket={ticket}
          />
        ))}
      </ul>
    )}
  </section>
);

export const RequesterDashboardPage = () => {
  const { user } = useAuth();
  const dashboardQuery = useQuery({
    ...requesterDashboardQueryOptions(user?.id ?? 0, user?.role ?? "Requester"),
    enabled: user !== null && user.role === "Requester",
  });
  const dashboard = dashboardQuery.isError ? undefined : dashboardQuery.data;
  const forbidden =
    dashboardQuery.error instanceof ApiRequestError &&
    dashboardQuery.error.status === 403;

  return (
    <AppShell eyebrow="Requester workspace" title="Dashboard">
      <div className="page-actions dashboard-actions">
        <p className="page-description">
          Your active Tickets, items waiting for you, and recent progress.
        </p>
        <button
          aria-label="Refresh dashboard"
          className="button button-secondary"
          disabled={dashboardQuery.isFetching}
          onClick={() => void dashboardQuery.refetch()}
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

      {dashboardQuery.isError ? (
        <section className="surface-card feedback feedback-error" role="alert">
          <h2>
            {forbidden ? "Access denied" : "Dashboard could not be loaded"}
          </h2>
          <p>
            {forbidden
              ? "You do not have permission to view this dashboard."
              : "Could not load your dashboard. Check your connection and try again."}
          </p>
          <button
            className="button button-secondary"
            disabled={dashboardQuery.isFetching}
            onClick={() => void dashboardQuery.refetch()}
            type="button"
          >
            Retry dashboard
          </button>
        </section>
      ) : null}

      {dashboard === undefined ? null : (
        <>
          <p className="dashboard-window">
            Updated {formatBangkokDate(dashboard.generatedAt)} (Asia/Bangkok).
            Recent updates and resolutions cover{" "}
            {formatBangkokDate(dashboard.window.from)} through{" "}
            {formatBangkokDate(dashboard.window.through)}.
          </p>
          <section
            aria-label="Ticket metrics"
            className="dashboard-metrics-grid"
          >
            <DashboardCard
              count={dashboard.counts.activeTickets}
              label="Active Tickets"
              scope="active"
            />
            <DashboardCard
              count={dashboard.counts.waitingForRequester}
              label="Waiting for You"
              scope="waiting-for-requester"
            />
            <DashboardCard
              count={dashboard.counts.recentlyUpdated}
              from={dashboard.window.from}
              label="Recently Updated"
              scope="recently-updated"
              through={dashboard.window.through}
            />
            <DashboardCard
              count={dashboard.counts.recentlyResolved}
              from={dashboard.window.from}
              label="Recently Resolved"
              scope="recently-resolved"
              through={dashboard.window.through}
            />
          </section>
          <div className="dashboard-preview-grid">
            <TicketPreviewSection
              dateLabel="Updated"
              emptyMessage="No Tickets were updated in this seven-day window."
              emptyScope="recently-updated"
              from={dashboard.window.from}
              items={dashboard.previews.recentlyUpdated}
              resolved={false}
              through={dashboard.window.through}
              title="Recently Updated"
            />
            <TicketPreviewSection
              dateLabel="Resolved"
              emptyMessage="No Tickets were resolved in this seven-day window."
              emptyScope="recently-resolved"
              from={dashboard.window.from}
              items={dashboard.previews.recentlyResolved}
              resolved={true}
              through={dashboard.window.through}
              title="Recently Resolved"
            />
          </div>
        </>
      )}
    </AppShell>
  );
};
