import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getTicketActionHistory } from "@/api/actions";
import type { TicketAction } from "@/api/actions";
import { ApiRequestError } from "@/api/errors";
import type { ActionInteractionContext } from "@/components/actions-taken-edit";
import { formatBangkokDate, formatUser } from "@/lib/action-format";

const historyErrorMessage = (error: unknown): string => {
  if (error instanceof ApiRequestError && error.status === 403) {
    return "You are not allowed to read this history.";
  }
  if (error instanceof ApiRequestError && error.status === 404) {
    return "This Ticket or action history was not found.";
  }
  return "Unable to load action history. Try again.";
};

export const ActionHistory = ({
  actionId,
  currentAssignee,
  context,
}: {
  actionId: number;
  currentAssignee: TicketAction["assignee"];
  context: ActionInteractionContext;
}) => {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const history = useQuery({
    enabled: open,
    queryFn: async ({ signal }) =>
      await getTicketActionHistory(
        context.ticketId,
        actionId,
        { page, pageSize: 20 },
        signal
      ),
    queryKey: [
      "action-history",
      context.principalId,
      context.principalRole,
      context.ticketId,
      actionId,
      page,
      20,
    ],
    retry: (count, error) =>
      !(
        error instanceof ApiRequestError &&
        (error.status === 403 || error.status === 404)
      ) && count < 1,
  });
  const assigneeLabel = (assigneeId: number): string => {
    const knownAssignee =
      currentAssignee.id === assigneeId
        ? currentAssignee
        : context.owners.find((owner) => owner.id === assigneeId);
    return `${knownAssignee?.displayName ?? "Former assignee"} (User #${assigneeId})`;
  };
  const historyId = `action-history-${actionId}`;
  return (
    <div className="action-history">
      <button
        aria-controls={historyId}
        aria-expanded={open}
        className="button button-secondary"
        onClick={() => {
          setOpen((value) => !value);
        }}
        type="button"
      >
        {open ? "Hide" : "View"} history for Action Taken #{actionId}
      </button>
      {open ? (
        <section aria-labelledby={`${historyId}-heading`} id={historyId}>
          <h4 id={`${historyId}-heading`}>Action Taken #{actionId} history</h4>
          {history.isPending ? (
            <p className="loading-line" role="status">
              Loading action history…
            </p>
          ) : null}
          {history.isError ? (
            <div className="feedback feedback-error" role="alert">
              <p>{historyErrorMessage(history.error)}</p>
              <button
                className="button button-secondary"
                disabled={history.isFetching}
                onClick={() => void history.refetch()}
                type="button"
              >
                Retry action history
              </button>
            </div>
          ) : null}
          {history.data?.items.length === 0 ? (
            <p className="empty-inline">No action revisions on this page.</p>
          ) : null}
          {history.data === undefined ? null : (
            <ol className="action-list">
              {history.data.items.map((event) => (
                <li className="action-card" key={event.id}>
                  <p>
                    <strong>{event.eventType}</strong> · Version{" "}
                    {event.actionVersion}
                  </p>
                  <p className="action-meta">
                    {formatUser(event.actor)} ·{" "}
                    {formatBangkokDate(event.createdAt)}
                  </p>
                  <p>
                    {event.fromStatus ?? "—"} → {event.toStatus ?? "—"}
                  </p>
                  {event.snapshot === null ? null : (
                    <dl className="action-details">
                      <div>
                        <dt>Action Description</dt>
                        <dd className="action-read-text">
                          {event.snapshot.description}
                        </dd>
                      </div>
                      <div>
                        <dt>Result</dt>
                        <dd className="action-read-text">
                          {event.snapshot.result ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Assignee</dt>
                        <dd>{assigneeLabel(event.snapshot.assigneeId)}</dd>
                      </div>
                      <div>
                        <dt>Follow-Up Required</dt>
                        <dd>
                          {event.snapshot.followUpRequired ? "Yes" : "No"}
                        </dd>
                      </div>
                      <div>
                        <dt>Follow-up Note</dt>
                        <dd className="action-read-text">
                          {event.snapshot.followUpNote ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Attachment Notes</dt>
                        <dd className="action-read-text">
                          {event.snapshot.attachmentNotes ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{event.snapshot.status}</dd>
                      </div>
                    </dl>
                  )}
                </li>
              ))}
            </ol>
          )}
          {(history.data?.totalPages ?? 0) > 1 ? (
            <nav
              aria-label={`Action Taken #${actionId} history pages`}
              className="pagination"
            >
              <button
                className="button button-secondary"
                disabled={page <= 1 || history.isFetching}
                onClick={() => {
                  setPage((value) => value - 1);
                }}
                type="button"
              >
                Previous history
              </button>
              <span>
                Page {page} of {history.data?.totalPages} ·{" "}
                {history.data?.totalItems} revision(s)
              </span>
              <button
                className="button button-secondary"
                disabled={
                  page >= (history.data?.totalPages ?? 0) || history.isFetching
                }
                onClick={() => {
                  setPage((value) => value + 1);
                }}
                type="button"
              >
                Next history
              </button>
            </nav>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
