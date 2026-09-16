import {
  ArrowLeft01Icon,
  Attachment01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ApiConnectionError } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import { ticketQueryOptions } from "@/api/query-options";
import { downloadTicketAttachment } from "@/api/requester";
import {
  AccessDenied,
  AppShell,
  AuthLoading,
  AuthRequired,
} from "@/components/app-shell";
import { ReadOnlyField } from "@/components/form-field";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/class-names";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatFileSize = (byteSize: number) =>
  byteSize < 1024
    ? `${byteSize} B`
    : `${(byteSize / 1024 / 1024).toFixed(2)} MB`;

const getDetailErrorMessage = (error: unknown): string => {
  if (error instanceof ApiConnectionError) {
    return "Unable to connect to the TokTickIT API. Check the server and retry.";
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "This Ticket could not be loaded. Try again.";
};

// oxlint-disable-next-line complexity -- this page renders documented read-only detail and attachment states.
const StaffTicketDetailContent = ({
  onAccessError,
  ticketId,
}: {
  onAccessError: (error: ApiRequestError) => void;
  ticketId: string;
}) => {
  const { user } = useAuth();
  const numericTicketId = Number(ticketId);
  const hasValidTicketId =
    /^[1-9]\d*$/u.test(ticketId) &&
    Number.isSafeInteger(numericTicketId) &&
    numericTicketId <= 2_147_483_647;
  const ticketQuery = useQuery({
    ...ticketQueryOptions(numericTicketId, user?.id ?? 0),
    enabled:
      (user?.role === "IT Staff" || user?.role === "Administrator") &&
      !user.mustChangePassword &&
      hasValidTicketId,
  });
  const [operationError, setOperationError] = useState<string | null>(null);

  useEffect(() => {
    if (
      ticketQuery.error instanceof ApiRequestError &&
      ticketQuery.error.status === 403
    ) {
      onAccessError(ticketQuery.error);
    }
  }, [onAccessError, ticketQuery.error]);

  if (user === null || user.mustChangePassword) {
    return <AuthRequired />;
  }

  if (user.role !== "IT Staff" && user.role !== "Administrator") {
    return <AccessDenied />;
  }

  const ticket = ticketQuery.data;

  const download = async (attachmentId: number) => {
    try {
      const result = await downloadTicketAttachment(
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
      if (error instanceof ApiRequestError && error.status === 403) {
        onAccessError(error);
        return;
      }

      setOperationError(
        error instanceof Error
          ? error.message
          : "Unable to download the Attachment."
      );
    }
  };

  return (
    <AppShell
      allowedRoles={["IT Staff", "Administrator"]}
      eyebrow={
        user.role === "Administrator"
          ? "Administrator workspace"
          : "IT Staff workspace"
      }
      title="Ticket Detail"
    >
      <div className="page-actions">
        <p className="page-description">
          Read-only operational view. Submitted Ticket data and evidence cannot
          be changed here.
        </p>
        <Link className="button button-secondary" to="/staff/tickets">
          <Icon icon={ArrowLeft01Icon} /> Back to Ticket Queue
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
          <p>{getDetailErrorMessage(ticketQuery.error)}</p>
          <div className="button-row">
            <button
              className="button button-secondary"
              onClick={() => void ticketQuery.refetch()}
              type="button"
            >
              Retry
            </button>
            <Link className="button button-tertiary" to="/staff/tickets">
              Back to Ticket Queue
            </Link>
          </div>
        </div>
      ) : null}

      {hasValidTicketId ? null : (
        <div className="surface-card feedback feedback-error" role="alert">
          <h2>Invalid Ticket Number</h2>
          <p>Use a valid Ticket link from the Ticket Queue.</p>
        </div>
      )}

      {ticket ? (
        <>
          <section
            aria-labelledby="staff-detail-information-heading"
            className="surface-card form-section"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Operational record</p>
                <h2 id="staff-detail-information-heading">
                  Ticket information
                </h2>
              </div>
              <div className="badge-group">
                <StatusBadge kind="priority" value={ticket.itPriority} />
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
              <ReadOnlyField label="IT Priority" value={ticket.itPriority} />
              <ReadOnlyField
                label="Current Status"
                value={ticket.currentStatus}
              />
              <ReadOnlyField
                label="Ticket Owner"
                value={ticket.owner?.displayName ?? "Unassigned"}
              />
              <ReadOnlyField label="Version" value={String(ticket.version)} />
              <ReadOnlyField
                label="Status Changed"
                value={formatDate(ticket.statusChangedAt)}
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

          {ticket.resolutionIndication ? (
            <section
              aria-labelledby="resolution-indication-heading"
              className="surface-card form-section"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Operational history</p>
                  <h2 id="resolution-indication-heading">
                    Resolution indication
                  </h2>
                </div>
              </div>
              <div className="readonly-grid">
                <ReadOnlyField
                  label="Indicated by"
                  value={ticket.resolutionIndication.author.displayName}
                />
                <ReadOnlyField
                  label="Indicated at"
                  value={formatDate(ticket.resolutionIndication.createdAt)}
                />
              </div>
            </section>
          ) : null}

          <section
            aria-labelledby="staff-attachments-heading"
            className="surface-card form-section"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Evidence</p>
                <h2 id="staff-attachments-heading">Attachments</h2>
              </div>
              <span className="attachment-count">
                {ticket.attachments.length} metadata record(s)
              </span>
            </div>

            {ticket.attachments.length === 0 ? (
              <p className="empty-inline">No Attachments have been added.</p>
            ) : null}
            <div className="attachment-list">
              {ticket.attachments.map((attachment) => (
                <article
                  className={cn(
                    "attachment-item",
                    attachment.state.toLowerCase()
                  )}
                  key={attachment.id}
                >
                  <div className="attachment-item-main">
                    <span aria-hidden="true" className="attachment-icon">
                      <Icon icon={Attachment01Icon} />
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
                      className={cn(
                        "state-label",
                        attachment.state.toLowerCase()
                      )}
                    >
                      <span aria-hidden="true">
                        <Icon
                          icon={
                            attachment.state === "Active"
                              ? CheckmarkCircle02Icon
                              : CancelCircleIcon
                          }
                        />
                      </span>{" "}
                      {attachment.state}
                    </span>
                    {attachment.state === "Active" ? (
                      <button
                        className="button button-secondary"
                        onClick={() => void download(attachment.id)}
                        type="button"
                      >
                        Download
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            {operationError === null ? null : (
              <div className="operation-status" role="alert">
                <span className="error-message">{operationError}</span>
              </div>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
};

export const StaffTicketDetailPage = ({ ticketId }: { ticketId: string }) => {
  const { refetchAuth, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accessError, setAccessError] = useState<ApiRequestError | null>(null);
  const handledAccessError = useRef<ApiRequestError | null>(null);

  useEffect(() => {
    if (accessError === null || handledAccessError.current === accessError) {
      return;
    }

    handledAccessError.current = accessError;
    void queryClient.cancelQueries({ queryKey: ["ticket"] });
    queryClient.removeQueries({ queryKey: ["ticket"] });
    void refetchAuth();
    if (accessError.code === "PASSWORD_CHANGE_REQUIRED") {
      void navigate({ replace: true, to: "/change-password" });
    }
  }, [accessError, navigate, queryClient, refetchAuth]);

  if (accessError !== null) {
    return accessError.code === "PASSWORD_CHANGE_REQUIRED" ? (
      <AuthLoading />
    ) : (
      <AccessDenied />
    );
  }

  if (user === null || user.mustChangePassword) {
    return <AuthRequired />;
  }

  if (user.role !== "IT Staff" && user.role !== "Administrator") {
    return <AccessDenied />;
  }

  return (
    <StaffTicketDetailContent
      key={user.id}
      onAccessError={setAccessError}
      ticketId={ticketId}
    />
  );
};
