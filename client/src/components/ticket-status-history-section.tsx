import { useQuery } from "@tanstack/react-query";

import { ApiRequestError } from "@/api/errors";
import { getTicketStatusHistory } from "@/api/staff";
import { getRequestErrorMessage } from "@/lib/request-error-message";

const HISTORY_PAGE_SIZE = 20;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiRequestError && error.status === 404) {
    return "This Ticket is not available to your account.";
  }

  return getRequestErrorMessage(
    error,
    "Unable to load Ticket status history. Try again."
  );
};

interface TicketStatusHistorySectionProps {
  ticketId: number;
}

export const TicketStatusHistorySection = ({
  ticketId,
}: TicketStatusHistorySectionProps) => {
  const historyQuery = useQuery({
    queryFn: async ({ signal }) =>
      await getTicketStatusHistory(
        ticketId,
        { page: 1, pageSize: HISTORY_PAGE_SIZE },
        signal
      ),
    queryKey: ["ticket-status-history", ticketId],
    retry: 1,
  });
  const events = historyQuery.data?.items ?? [];
  const totalItems = historyQuery.data?.totalItems ?? 0;

  return (
    <section
      aria-labelledby="ticket-status-history-heading"
      className="surface-card form-section ticket-status-history-section"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Ticket record</p>
          <h2 id="ticket-status-history-heading">Status history</h2>
          <p className="field-help">
            Earlier Ticket status changes were not recorded; this history begins
            with the Lab 4 rollout.
          </p>
        </div>
        <span className="attachment-count">
          {totalItems} change{totalItems === 1 ? "" : "s"}
        </span>
      </div>

      {historyQuery.isPending ? (
        <p aria-live="polite" className="loading-line" role="status">
          Loading status history…
        </p>
      ) : null}
      {historyQuery.isError ? (
        <div className="feedback feedback-error" role="alert">
          <p>{getErrorMessage(historyQuery.error)}</p>
          <button
            className="button button-secondary"
            onClick={() => void historyQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!historyQuery.isPending &&
      !historyQuery.isError &&
      events.length === 0 ? (
        <p className="empty-inline">No Ticket status changes recorded yet.</p>
      ) : null}
      {events.length > 0 ? (
        <ol className="ticket-entry-list">
          {events.map((event) => (
            <li className="ticket-entry" key={event.id}>
              <div className="ticket-entry-meta">
                <strong>
                  {event.fromStatus} → {event.toStatus}
                </strong>
                <time dateTime={event.createdAt}>
                  {formatDate(event.createdAt)}
                </time>
              </div>
              <p className="ticket-entry-content">
                {event.actor.displayName} ({event.actor.role}), Ticket version{" "}
                {event.ticketVersion}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
};
