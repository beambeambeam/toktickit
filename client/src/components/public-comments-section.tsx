import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { ApiConnectionError } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import { ticketCommentsQueryOptions } from "@/api/query-options";
import { postTicketComment } from "@/api/ticket-comments";
import { FormField } from "@/components/form-field";
import type { CurrentStatus, Entry } from "@/generated/hey-api/types.gen";

const MAX_COMMENT_CODE_POINTS = 5000;
const terminalStatuses = new Set<CurrentStatus>(["Closed", "Cancelled"]);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiConnectionError) {
    return "Unable to connect to the TokTickIT API. Check the server and retry.";
  }

  if (error instanceof ApiRequestError && error.status === 409) {
    return `${error.message} Refresh the Ticket before trying again.`;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to load public comments. Try again.";
};

const codePointLength = (value: string): number =>
  // oxlint-disable-next-line unicorn/prefer-spread -- comment contract counts Unicode code points.
  Array.from(value).length;

interface PublicCommentsSectionProps {
  canPost: boolean;
  currentStatus: CurrentStatus;
  principalId: number;
  ticketId: number;
}

const PublicCommentsSectionContent = ({
  canPost,
  currentStatus,
  principalId,
  ticketId,
}: PublicCommentsSectionProps) => {
  const queryClient = useQueryClient();
  const commentsQuery = useQuery(
    ticketCommentsQueryOptions(ticketId, principalId)
  );
  const [draft, setDraft] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isTerminal = terminalStatuses.has(currentStatus);

  const postMutation = useMutation({
    mutationFn: async (content: string) =>
      await postTicketComment(ticketId, content),
    onError: (error: unknown) => {
      setOperationError(getErrorMessage(error));
      setSuccessMessage(null);
    },
    onSuccess: (comment: Entry) => {
      queryClient.setQueryData<Entry[]>(
        ["ticket-comments", principalId, ticketId],
        (comments) => [...(comments ?? []), comment]
      );
      setDraft("");
      setOperationError(null);
      setSuccessMessage("Public Comment posted successfully.");
      void queryClient.invalidateQueries({
        queryKey: ["ticket-comments", principalId, ticketId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["ticket", principalId, ticketId],
      });
    },
    retry: false,
  });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    const submittedLength = codePointLength(draft);
    const contentLength = codePointLength(content);

    if (contentLength < 1 || submittedLength > MAX_COMMENT_CODE_POINTS) {
      setValidationError(
        `Comment must contain 1–${MAX_COMMENT_CODE_POINTS} submitted Unicode code points and at least one non-whitespace character.`
      );
      setOperationError(null);
      return;
    }

    if (isTerminal || !canPost || postMutation.isPending) {
      return;
    }

    setValidationError(null);
    setOperationError(null);
    setSuccessMessage(null);
    postMutation.mutate(content);
  };

  const comments = commentsQuery.data ?? [];
  const composer = (() => {
    if (isTerminal) {
      return (
        <p className="context-note">
          Closed and Cancelled Tickets are read-only. New public Comments cannot
          be posted.
        </p>
      );
    }

    if (!canPost) {
      return (
        <p className="context-note">
          Administrator access is read-only for the public conversation.
        </p>
      );
    }

    return (
      <form className="public-comment-compose" onSubmit={submit}>
        <FormField
          error={validationError ?? undefined}
          htmlFor={`public-comment-${ticketId}`}
          label="Public Comment"
          required
        >
          <textarea
            aria-describedby={`public-comment-help-${ticketId}`}
            aria-invalid={Boolean(validationError)}
            id={`public-comment-${ticketId}`}
            onChange={(event) => {
              setDraft(event.target.value);
              setValidationError(null);
              setOperationError(null);
              setSuccessMessage(null);
            }}
            placeholder="Write an update for the shared Ticket conversation"
            rows={5}
            value={draft}
          />
        </FormField>
        <p className="field-help" id={`public-comment-help-${ticketId}`}>
          Plain text only. {codePointLength(draft)} / {MAX_COMMENT_CODE_POINTS}{" "}
          submitted Unicode code points.
        </p>
        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={postMutation.isPending}
            type="submit"
          >
            {postMutation.isPending ? "Posting…" : "Post Public Comment"}
          </button>
        </div>
        <div aria-live="polite" className="operation-status" role="status">
          {successMessage === null ? null : (
            <span className="success-message">{successMessage}</span>
          )}
          {operationError === null ? null : (
            <span className="error-message" role="alert">
              {operationError}
            </span>
          )}
        </div>
      </form>
    );
  })();

  return (
    <section
      aria-labelledby="public-comments-heading"
      className="surface-card form-section public-comments-section"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Shared conversation</p>
          <h2 id="public-comments-heading">Public Comments</h2>
          <p className="field-help">
            Visible to the Requester, IT Staff, and Administrators. Comments are
            append-only plain text.
          </p>
        </div>
        <span className="attachment-count">
          {comments.length} comment{comments.length === 1 ? "" : "s"}
        </span>
      </div>

      {commentsQuery.isPending ? (
        <p aria-live="polite" className="loading-line" role="status">
          Loading Public Comments…
        </p>
      ) : null}
      {commentsQuery.isError ? (
        <div className="feedback feedback-error" role="alert">
          <p>{getErrorMessage(commentsQuery.error)}</p>
          <button
            className="button button-secondary"
            onClick={() => void commentsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!commentsQuery.isPending &&
      !commentsQuery.isError &&
      comments.length === 0 ? (
        <p className="empty-inline">No public comments yet.</p>
      ) : null}
      {comments.length > 0 ? (
        <ol className="ticket-entry-list">
          {comments.map((comment) => (
            <li className="ticket-entry" key={comment.id}>
              <div className="ticket-entry-meta">
                <strong>{comment.author.displayName}</strong>
                <time dateTime={comment.createdAt}>
                  {formatDate(comment.createdAt)}
                </time>
              </div>
              <p className="ticket-entry-content">{comment.content}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {composer}
    </section>
  );
};

export const PublicCommentsSection = (props: PublicCommentsSectionProps) => (
  <PublicCommentsSectionContent key={props.ticketId} {...props} />
);
