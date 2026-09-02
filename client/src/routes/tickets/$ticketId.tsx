import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { ticketQueryOptions } from "@/api/lab2-options";
import {
  downloadTicketAttachment,
  removeTicketAttachment,
  uploadTicketAttachments,
} from "@/api/requester";
import { AppShell, RequesterRequired } from "@/components/app-shell";
import { AttachmentPicker } from "@/components/attachment-picker";
import { FormField, ReadOnlyField } from "@/components/form-field";
import { StatusBadge } from "@/components/status-badge";
import { useRequester } from "@/context/requester";
import { validateSelectedFiles } from "@/lib/ticket-rules";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatFileSize = (byteSize: number) =>
  byteSize < 1024
    ? `${byteSize} B`
    : `${(byteSize / 1024 / 1024).toFixed(2)} MB`;

// oxlint-disable-next-line complexity -- this route renders the documented ticket and attachment states.
export const RequesterTicketDetailPage = () => {
  const { requester } = useRequester();
  const queryClient = useQueryClient();
  // oxlint-disable-next-line no-use-before-define -- TanStack Router route declaration follows the component.
  const { ticketId } = Route.useParams();
  const numericTicketId = Number(ticketId);
  const hasValidTicketId =
    Number.isSafeInteger(numericTicketId) && numericTicketId > 0;
  const ticketQuery = useQuery({
    ...ticketQueryOptions(requester?.id ?? 0, numericTicketId),
    enabled: requester !== null && hasValidTicketId,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [attachmentToRemove, setAttachmentToRemove] = useState<number | null>(
    null
  );
  const [removalReason, setRemovalReason] = useState("");
  const [removalError, setRemovalError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (requester === null) {
        throw new Error("Select a Development Requester first.");
      }

      return await uploadTicketAttachments(
        requester.id,
        numericTicketId,
        files
      );
    },
    onError: (error: unknown) => {
      setOperationError(
        error instanceof Error ? error.message : "Unable to add attachments."
      );
      setSuccessMessage(null);
    },
    onSuccess: () => {
      setFiles([]);
      setFileErrors([]);
      setOperationError(null);
      setSuccessMessage("Attachment(s) added successfully.");
      void queryClient.invalidateQueries({
        queryKey: ["ticket", requester?.id, numericTicketId],
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({
      attachmentId,
      reason,
    }: {
      attachmentId: number;
      reason: string;
    }) => {
      if (requester === null) {
        throw new Error("Select a Development Requester first.");
      }

      return await removeTicketAttachment(
        requester.id,
        numericTicketId,
        attachmentId,
        reason
      );
    },
    onError: (error: unknown) => {
      setRemovalError(
        error instanceof Error
          ? error.message
          : "Unable to remove the Attachment."
      );
    },
    onSuccess: () => {
      setAttachmentToRemove(null);
      setRemovalReason("");
      setRemovalError(null);
      setOperationError(null);
      setSuccessMessage(
        "Attachment removed. Its metadata remains in the Ticket history."
      );
      void queryClient.invalidateQueries({
        queryKey: ["ticket", requester?.id, numericTicketId],
      });
    },
  });

  if (requester === null) {
    return <RequesterRequired />;
  }

  const ticket = ticketQuery.data;

  const handleFiles = (selectedFiles: File[]) => {
    const result = validateSelectedFiles(selectedFiles);
    setFiles(result.validFiles);
    setFileErrors(result.errors);
    setOperationError(null);
    setSuccessMessage(null);
  };

  const submitRemoval = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = removalReason.trim();

    if (trimmedReason.length < 3 || trimmedReason.length > 500) {
      setRemovalError(
        "Removal reason must contain 3–500 characters after trimming."
      );
      return;
    }

    if (attachmentToRemove === null) {
      return;
    }

    setRemovalError(null);
    removeMutation.mutate({
      attachmentId: attachmentToRemove,
      reason: trimmedReason,
    });
  };

  const download = async (attachmentId: number) => {
    try {
      const result = await downloadTicketAttachment(
        requester.id,
        numericTicketId,
        attachmentId
      );
      const url = window.URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setOperationError(null);
    } catch (error: unknown) {
      setOperationError(
        error instanceof Error
          ? error.message
          : "Unable to download the Attachment."
      );
    }
  };

  return (
    <AppShell eyebrow="Requester workspace" title="Ticket Detail">
      <div className="page-actions">
        <p className="page-description">
          Read-only view of your saved support request.
        </p>
        <Link className="button button-secondary" to="/tickets">
          ← Back to My Tickets
        </Link>
      </div>

      {ticketQuery.isPending ? (
        <p aria-live="polite" className="loading-line" role="status">
          Loading Ticket Detail…
        </p>
      ) : null}
      {ticketQuery.isError ? (
        <div className="surface-card feedback feedback-error" role="alert">
          <h2>Ticket unavailable</h2>
          <p>
            {ticketQuery.error instanceof Error
              ? ticketQuery.error.message
              : "This Ticket could not be loaded."}
          </p>
          <Link className="button button-secondary" to="/tickets">
            Back to My Tickets
          </Link>
        </div>
      ) : null}
      {hasValidTicketId ? null : (
        <div className="surface-card feedback feedback-error" role="alert">
          <h2>Invalid Ticket Number</h2>
          <p>Use a valid Ticket link from My Tickets.</p>
        </div>
      )}

      {ticket ? (
        <>
          <section
            className="surface-card form-section"
            aria-labelledby="detail-information-heading"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Saved request</p>
                <h2 id="detail-information-heading">Ticket information</h2>
              </div>
              <div className="badge-group">
                <StatusBadge kind="priority" value={ticket.requestedPriority} />
                <StatusBadge kind="status" value={ticket.currentStatus} />
              </div>
            </div>
            <div className="readonly-grid detail-grid">
              <ReadOnlyField
                label="Ticket Number"
                value={ticket.ticketNumber}
              />
              <ReadOnlyField
                label="Ticket Date"
                value={formatDate(ticket.ticketDate)}
              />
              <ReadOnlyField
                label="Requester"
                value={`${ticket.requester.displayName} · ${ticket.requester.email}`}
              />
              <ReadOnlyField
                label="Last Updated"
                value={formatDate(ticket.updatedAt)}
              />
              <ReadOnlyField label="Category" value={ticket.category.name} />
              <ReadOnlyField
                label="Related System"
                value={ticket.relatedSystem.name}
              />
              <ReadOnlyField
                label="Requested Priority"
                value={ticket.requestedPriority}
              />
              <ReadOnlyField
                label="Current Status"
                value={ticket.currentStatus}
              />
              <div className="form-field readonly-field wide-field">
                <span className="field-label">Ticket Summary</span>
                <output>{ticket.summary}</output>
              </div>
              <div className="form-field readonly-field wide-field">
                <span className="field-label">Description</span>
                <output className="multiline-output">
                  {ticket.description}
                </output>
              </div>
            </div>
          </section>

          <section
            className="surface-card form-section"
            aria-labelledby="attachments-heading"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Evidence</p>
                <h2 id="attachments-heading">Attachments</h2>
              </div>
              <span className="attachment-count">
                {ticket.attachments.length} metadata record(s)
              </span>
            </div>

            <AttachmentPicker
              disabled={
                uploadMutation.isPending ||
                ticket.attachments.filter(
                  (attachment) => attachment.state === "Active"
                ).length >= 5
              }
              errors={fileErrors}
              files={files}
              onChange={handleFiles}
            />
            <div className="form-actions attachment-upload-actions">
              <button
                className="button button-primary"
                disabled={
                  files.length === 0 ||
                  fileErrors.length > 0 ||
                  uploadMutation.isPending
                }
                onClick={() => {
                  uploadMutation.mutate();
                }}
                type="button"
              >
                {uploadMutation.isPending ? "Uploading…" : "Add Attachment(s)"}
              </button>
            </div>

            {ticket.attachments.length === 0 ? (
              <p className="empty-inline">No Attachments have been added.</p>
            ) : null}
            <div className="attachment-list">
              {ticket.attachments.map((attachment) => (
                <article
                  className={`attachment-item ${attachment.state.toLowerCase()}`}
                  key={attachment.id}
                >
                  <div className="attachment-item-main">
                    <span aria-hidden="true" className="attachment-icon">
                      ▧
                    </span>
                    <div>
                      <h3>{attachment.originalFilename}</h3>
                      <p>
                        {attachment.mediaType} ·{" "}
                        {formatFileSize(attachment.byteSize)} · Uploaded{" "}
                        {formatDate(attachment.uploadedAt)}
                      </p>
                      {attachment.state === "Removed" ? (
                        <p className="removed-note">
                          Removed{" "}
                          {attachment.removedAt === null
                            ? "unknown time"
                            : formatDate(attachment.removedAt)}
                          : {attachment.removalReason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="attachment-item-actions">
                    <span
                      className={`state-label ${attachment.state.toLowerCase()}`}
                    >
                      <span aria-hidden="true">
                        {attachment.state === "Active" ? "●" : "×"}
                      </span>{" "}
                      {attachment.state}
                    </span>
                    {attachment.state === "Active" ? (
                      <>
                        <button
                          className="button button-secondary"
                          onClick={() => void download(attachment.id)}
                          type="button"
                        >
                          Download
                        </button>
                        <button
                          className="button button-danger"
                          onClick={() => {
                            setAttachmentToRemove(attachment.id);
                            setRemovalReason("");
                            setRemovalError(null);
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <div aria-live="polite" className="operation-status" role="status">
              {successMessage !== null && successMessage.length > 0 ? (
                <span className="success-message">✓ {successMessage}</span>
              ) : null}
              {operationError !== null && operationError.length > 0 ? (
                <span className="error-message">{operationError}</span>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {attachmentToRemove === null ? null : (
        <div
          aria-labelledby="remove-attachment-title"
          aria-modal="true"
          className="dialog-backdrop"
          role="dialog"
        >
          <form
            className="surface-card confirmation-dialog"
            onSubmit={submitRemoval}
          >
            <p className="eyebrow">Confirm action</p>
            <h2 id="remove-attachment-title">Remove Attachment?</h2>
            <p>
              The file will become unavailable, but its metadata will remain in
              Ticket history.
            </p>
            <FormField
              error={removalError ?? undefined}
              htmlFor="removal-reason"
              label="Removal reason"
              required
            >
              <textarea
                aria-describedby={
                  removalError !== null && removalError.length > 0
                    ? "removal-reason-error"
                    : undefined
                }
                aria-invalid={Boolean(removalError)}
                id="removal-reason"
                maxLength={500}
                onChange={(event) => {
                  setRemovalReason(event.target.value);
                }}
                placeholder="Explain why this evidence is no longer needed"
                rows={4}
                value={removalReason}
              />
            </FormField>
            <div className="form-actions">
              <button
                className="button button-secondary"
                onClick={() => {
                  setAttachmentToRemove(null);
                  setRemovalError(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-danger"
                disabled={removeMutation.isPending}
                type="submit"
              >
                {removeMutation.isPending ? "Removing…" : "Confirm removal"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/tickets/$ticketId")({
  component: RequesterTicketDetailPage,
});
