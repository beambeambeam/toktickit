import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ApiRequestError } from "@/api/errors";
import { getTicketStatusHistory } from "@/api/staff";
import { formatBangkokDate } from "@/lib/action-format";
import { getRequestErrorMessage } from "@/lib/request-error-message";

const HISTORY_PAGE_SIZE = 20;

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
  const [pageState, setPageState] = useState({ page: 1, ticketId });
  // Start again at page 1 when the section shows a different Ticket.
  const page = pageState.ticketId === ticketId ? pageState.page : 1;
  const setPage = (nextPage: number) => {
    setPageState({ page: nextPage, ticketId });
  };
  const historyQuery = useQuery({
    queryFn: async ({ signal }) =>
      await getTicketStatusHistory(
        ticketId,
        { page, pageSize: HISTORY_PAGE_SIZE },
        signal
      ),
    queryKey: ["ticket-status-history", ticketId, page],
    retry: 1,
  });
  const historyPage = historyQuery.data;
  const events = historyPage?.items ?? [];
  const totalItems = historyPage?.totalItems ?? 0;

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
                  {formatBangkokDate(event.createdAt)}
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
      {historyPage !== undefined && historyPage.totalPages > 1 ? (
        <nav aria-label="Status history pages" className="pagination">
          <button
            className="button button-secondary"
            disabled={page <= 1 || historyQuery.isFetching}
            onClick={() => {
              setPage(Math.max(1, page - 1));
            }}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {historyPage.page} of {historyPage.totalPages} ·{" "}
            {historyPage.totalItems} total
          </span>
          <button
            className="button button-secondary"
            disabled={page >= historyPage.totalPages || historyQuery.isFetching}
            onClick={() => {
              setPage(Math.min(historyPage.totalPages, page + 1));
            }}
            type="button"
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
};
