import type { TicketAction, TicketActionsPage } from "@/api/actions";
import { ApiRequestError } from "@/api/errors";
import { StatusBadge } from "@/components/status-badge";

const formatBangkokDate = (value: string | null): string => {
  if (value === null) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Unknown time";
  }

  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date)} (Asia/Bangkok)`;
};

const formatUser = (
  user: { displayName: string; role: string } | null,
  empty = "—"
): string => (user === null ? empty : `${user.displayName} · ${user.role}`);

const getActionsErrorMessage = (error: unknown): string => {
  if (error instanceof ApiRequestError && error.status === 403) {
    return "You do not have permission to read Actions Taken for this Ticket.";
  }

  if (error instanceof ApiRequestError && error.status === 404) {
    return "This Ticket or its Actions Taken list was not found.";
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to load Actions Taken. Try again.";
};

const renderOptionalText = (value: string | null) => (
  <span className="action-value multiline-output">{value ?? "—"}</span>
);

const ActionDetails = ({ action }: { action: TicketAction }) => (
  <article className="action-card">
    <div className="action-card-heading">
      <div>
        <p className="eyebrow">Action Taken #{action.id}</p>
        <h3>{formatBangkokDate(action.createdAt)}</h3>
      </div>
      <StatusBadge kind="status" value={action.status} />
    </div>
    <dl className="action-details">
      <div>
        <dt>Action Description</dt>
        <dd>{renderOptionalText(action.description)}</dd>
      </div>
      <div>
        <dt>Result</dt>
        <dd>{renderOptionalText(action.result)}</dd>
      </div>
      <div>
        <dt>Assignee</dt>
        <dd>
          <span className="action-value">{formatUser(action.assignee)}</span>
          <span className="action-meta">
            {action.assignee.isActive ? "Active" : "Inactive"} ·{" "}
            {action.assignee.isEligible ? "eligible" : "ineligible"}
          </span>
        </dd>
      </div>
      <div>
        <dt>Created by</dt>
        <dd>{formatUser(action.createdBy)}</dd>
      </div>
      <div>
        <dt>Performed by</dt>
        <dd>{formatUser(action.performedBy, "Not started")}</dd>
      </div>
      <div>
        <dt>Follow-Up Required</dt>
        <dd>{action.followUpRequired ? "Yes" : "No"}</dd>
      </div>
      {action.followUpNote === null ? null : (
        <div>
          <dt>Follow-up Note</dt>
          <dd>{renderOptionalText(action.followUpNote)}</dd>
        </div>
      )}
      {action.attachmentNotes === null ? null : (
        <div>
          <dt>Attachment Notes</dt>
          <dd>{renderOptionalText(action.attachmentNotes)}</dd>
        </div>
      )}
      <div>
        <dt>Version</dt>
        <dd>{action.version}</dd>
      </div>
      <div>
        <dt>Updated</dt>
        <dd>{formatBangkokDate(action.updatedAt)}</dd>
      </div>
      <div>
        <dt>Started</dt>
        <dd>{formatBangkokDate(action.startedAt)}</dd>
      </div>
      <div>
        <dt>Completed</dt>
        <dd>
          {formatBangkokDate(action.completedAt)}
          {action.completedBy === null ? null : (
            <span className="action-meta">
              by {formatUser(action.completedBy)}
            </span>
          )}
        </dd>
      </div>
      <div>
        <dt>Cancelled</dt>
        <dd>
          {formatBangkokDate(action.cancelledAt)}
          {action.cancelledBy === null ? null : (
            <span className="action-meta">
              by {formatUser(action.cancelledBy)}
            </span>
          )}
        </dd>
      </div>
    </dl>
  </article>
);

export interface ActionsTakenListProps {
  actionPage: TicketActionsPage | undefined;
  actionsError: unknown;
  actionsFetching: boolean;
  actionsPending: boolean;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  page: number;
}

export const ActionsTakenList = ({
  actionPage,
  actionsError,
  actionsFetching,
  actionsPending,
  onPageChange,
  onRetry,
  page,
}: ActionsTakenListProps) => (
  <>
    {actionsPending ? (
      <p aria-live="polite" className="loading-line" role="status">
        Loading Actions Taken…
      </p>
    ) : null}
    {actionsError === null ? null : (
      <div className="feedback feedback-error" role="alert">
        <h3>Actions Taken unavailable</h3>
        <p>{getActionsErrorMessage(actionsError)}</p>
        <button
          className="button button-secondary"
          onClick={onRetry}
          type="button"
        >
          Retry Actions Taken
        </button>
      </div>
    )}
    {actionPage?.totalItems === 0 ? (
      <p className="empty-inline">No Actions Taken yet.</p>
    ) : null}
    {actionPage !== undefined && actionPage.items.length > 0 ? (
      <ol className="action-list">
        {actionPage.items.map((actionItem) => (
          <li className="action-list-item" key={actionItem.id}>
            <ActionDetails action={actionItem} />
          </li>
        ))}
      </ol>
    ) : null}
    {actionPage !== undefined && actionPage.totalPages > 1 ? (
      <nav aria-label="Actions Taken pages" className="pagination">
        <button
          className="button button-secondary"
          disabled={page <= 1 || actionsFetching}
          onClick={() => {
            onPageChange(Math.max(1, page - 1));
          }}
          type="button"
        >
          Previous
        </button>
        <span>
          Page {actionPage.page} of {actionPage.totalPages} ·{" "}
          {actionPage.totalItems} total
        </span>
        <button
          className="button button-secondary"
          disabled={page >= actionPage.totalPages || actionsFetching}
          onClick={() => {
            onPageChange(Math.min(actionPage.totalPages, page + 1));
          }}
          type="button"
        >
          Next
        </button>
      </nav>
    ) : null}
  </>
);
