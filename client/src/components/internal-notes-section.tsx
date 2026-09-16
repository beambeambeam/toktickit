import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { ApiConnectionError } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import { postTicketInternalNote } from "@/api/internal-notes";
import { internalNotesQueryOptions } from "@/api/query-options";
import { FormField } from "@/components/form-field";
import type { CurrentStatus, Entry } from "@/generated/hey-api/types.gen";

const MAX_INTERNAL_NOTE_CODE_POINTS = 5000;
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

  return "Unable to load Internal Notes. Try again.";
};

const codePointLength = (value: string): number =>
  // oxlint-disable-next-line unicorn/prefer-spread -- internal-note contract counts Unicode code points.
  Array.from(value).length;

interface InternalNotesSectionProps {
  canPost: boolean;
  currentStatus: CurrentStatus;
  principalId: number;
  ticketId: number;
}

const InternalNotesSectionContent = ({
  canPost,
  currentStatus,
  principalId,
  ticketId,
}: InternalNotesSectionProps) => {
  const queryClient = useQueryClient();
  const notesQuery = useQuery(internalNotesQueryOptions(ticketId, principalId));
  const [draft, setDraft] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isTerminal = terminalStatuses.has(currentStatus);

  const addMutation = useMutation({
    mutationFn: async (content: string) =>
      await postTicketInternalNote(ticketId, content),
    onError: (error: unknown) => {
      setOperationError(getErrorMessage(error));
      setSuccessMessage(null);
    },
    onSuccess: (note: Entry) => {
      queryClient.setQueryData<Entry[]>(
        ["internal-notes", principalId, ticketId],
        (notes) => [...(notes ?? []), note]
      );
      setDraft("");
      setOperationError(null);
      setSuccessMessage("Internal Note added successfully.");
      void queryClient.invalidateQueries({
        queryKey: ["internal-notes", principalId, ticketId],
      });
    },
    retry: false,
  });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    const length = codePointLength(content);

    if (length < 1 || length > MAX_INTERNAL_NOTE_CODE_POINTS) {
      setValidationError(
        `Internal Note must contain 1–${MAX_INTERNAL_NOTE_CODE_POINTS} Unicode code points after trimming.`
      );
      setOperationError(null);
      return;
    }

    if (isTerminal || !canPost || addMutation.isPending) {
      return;
    }

    setValidationError(null);
    setOperationError(null);
    setSuccessMessage(null);
    addMutation.mutate(content);
  };

  const notes = notesQuery.data ?? [];
  const composer = (() => {
    if (isTerminal) {
      return (
        <p className="context-note">
          Closed and Cancelled Tickets are read-only. New Internal Notes cannot
          be added.
        </p>
      );
    }

    if (!canPost) {
      return (
        <p className="context-note">
          Administrator access is read-only for Internal Notes.
        </p>
      );
    }

    return (
      <form className="internal-note-compose" onSubmit={submit}>
        <FormField
          error={validationError ?? undefined}
          htmlFor={`internal-note-${ticketId}`}
          label="Internal Note"
          required
        >
          <textarea
            aria-describedby={`internal-note-help-${ticketId}`}
            aria-invalid={Boolean(validationError)}
            id={`internal-note-${ticketId}`}
            onChange={(event) => {
              setDraft(event.target.value);
              setValidationError(null);
              setOperationError(null);
              setSuccessMessage(null);
            }}
            placeholder="Record a private operational note"
            rows={5}
            value={draft}
          />
        </FormField>
        <p className="field-help" id={`internal-note-help-${ticketId}`}>
          Plain text only. {codePointLength(draft.trim())} /{" "}
          {MAX_INTERNAL_NOTE_CODE_POINTS} Unicode code points after trimming.
        </p>
        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={addMutation.isPending}
            type="submit"
          >
            {addMutation.isPending ? "Adding…" : "Add Internal Note"}
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
      aria-labelledby="internal-notes-heading"
      className="surface-card form-section internal-notes-section"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Private operations</p>
          <h2 id="internal-notes-heading">Internal Notes</h2>
          <p className="field-help">
            Visible only to IT Staff and Administrators. Notes are append-only
            plain text.
          </p>
        </div>
        <span className="attachment-count">
          {notes.length} note{notes.length === 1 ? "" : "s"}
        </span>
      </div>

      {notesQuery.isPending ? (
        <p aria-live="polite" className="loading-line" role="status">
          Loading Internal Notes…
        </p>
      ) : null}
      {notesQuery.isError ? (
        <div className="feedback feedback-error" role="alert">
          <p>{getErrorMessage(notesQuery.error)}</p>
          <button
            className="button button-secondary"
            onClick={() => void notesQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!notesQuery.isPending && !notesQuery.isError && notes.length === 0 ? (
        <p className="empty-inline">No Internal Notes yet.</p>
      ) : null}
      {notes.length > 0 ? (
        <ol className="ticket-entry-list">
          {notes.map((note) => (
            <li className="ticket-entry" key={note.id}>
              <div className="ticket-entry-meta">
                <strong>{note.author.displayName}</strong>
                <time dateTime={note.createdAt}>
                  {formatDate(note.createdAt)}
                </time>
              </div>
              <p className="ticket-entry-content">{note.content}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {composer}
    </section>
  );
};

export const InternalNotesSection = (props: InternalNotesSectionProps) => (
  <InternalNotesSectionContent key={props.ticketId} {...props} />
);
