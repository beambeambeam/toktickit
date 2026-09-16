import {
  ArrowLeft01Icon,
  Attachment01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ApiConnectionError } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import { ticketQueryOptions } from "@/api/query-options";
import { downloadTicketAttachment } from "@/api/requester";
import {
  claimStaffTicket,
  updateStaffTicketItPriority,
  updateStaffTicketOwner,
} from "@/api/staff";
import { staffOwnersQueryOptions } from "@/api/staff-query-options";
import {
  AccessDenied,
  AppShell,
  AuthLoading,
  AuthRequired,
} from "@/components/app-shell";
import { FormField, ReadOnlyField } from "@/components/form-field";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/class-names";
import { isRequestedPriority } from "@/lib/ticket-priorities";

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
  const queryClient = useQueryClient();
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
  const ownersQuery = useQuery({
    ...staffOwnersQueryOptions(),
    enabled: user?.role === "IT Staff" && !user.mustChangePassword,
  });
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [selectedItPriority, setSelectedItPriority] = useState<string | null>(
    null
  );

  const updateDetail = (
    nextTicket: typeof ticketQuery.data,
    message: string
  ) => {
    if (nextTicket === undefined) {
      return;
    }

    queryClient.setQueryData(
      ["ticket", user?.id ?? 0, numericTicketId],
      nextTicket
    );
    setOperationError(null);
    setOperationSuccess(message);
    setSelectedOwnerId(nextTicket.owner?.id.toString() ?? "");
    setSelectedItPriority(nextTicket.itPriority);
  };

  const reportMutationError = (error: unknown, fallback: string) => {
    if (error instanceof ApiRequestError && error.status === 403) {
      onAccessError(error);
      return;
    }

    setOperationSuccess(null);
    setOperationError(error instanceof Error ? error.message : fallback);
  };

  const claimMutation = useMutation({
    mutationFn: async (version: number) =>
      await claimStaffTicket(numericTicketId, { version }),
    onError: (error: unknown) => {
      reportMutationError(error, "Unable to claim the Ticket.");
      if (error instanceof ApiRequestError && error.status === 409) {
        void ticketQuery.refetch();
      }
    },
    onSuccess: (nextTicket) => {
      updateDetail(nextTicket, "Ticket claimed successfully.");
    },
  });

  const ownerMutation = useMutation({
    mutationFn: async (input: { ownerId: number | null; version: number }) =>
      await updateStaffTicketOwner(numericTicketId, input),
    onError: (error: unknown) => {
      reportMutationError(error, "Unable to save the Ticket Owner.");
      if (error instanceof ApiRequestError && error.status === 409) {
        void ticketQuery.refetch();
      }
    },
    onSuccess: (nextTicket) => {
      updateDetail(nextTicket, "Ticket Owner saved successfully.");
    },
  });

  const priorityMutation = useMutation({
    mutationFn: async (input: {
      itPriority: "Low" | "Medium" | "High" | "Urgent";
      version: number;
    }) => await updateStaffTicketItPriority(numericTicketId, input),
    onError: (error: unknown) => {
      reportMutationError(error, "Unable to save IT Priority.");
      if (error instanceof ApiRequestError && error.status === 409) {
        void ticketQuery.refetch();
      }
    },
    onSuccess: (nextTicket) => {
      updateDetail(nextTicket, "IT Priority saved successfully.");
    },
  });

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
  const ownerValue = selectedOwnerId ?? ticket?.owner?.id.toString() ?? "";
  const itPriorityValue = selectedItPriority ?? ticket?.itPriority ?? "Low";
  const canOperate =
    user.role === "IT Staff" &&
    ticket !== undefined &&
    !["Resolved", "Closed", "Cancelled"].includes(ticket.currentStatus);
  const operationBusy =
    claimMutation.isPending ||
    ownerMutation.isPending ||
    priorityMutation.isPending;

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
          Submitted Ticket data and evidence stay read-only. IT Staff can manage
          ownership and IT Priority below.
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

          {user.role === "IT Staff" ? (
            <section
              aria-labelledby="staff-operations-heading"
              className="surface-card form-section"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Staff actions</p>
                  <h2 id="staff-operations-heading">Operational controls</h2>
                </div>
                <span className="required-note">
                  Version {ticket.version} · Requested Priority stays{" "}
                  {ticket.requestedPriority}
                </span>
              </div>

              {canOperate ? (
                <div className="form-grid-two">
                  <FormField htmlFor="ticket-owner" label="Ticket Owner">
                    <select
                      disabled={
                        ownersQuery.isPending ||
                        ownersQuery.isError ||
                        operationBusy
                      }
                      id="ticket-owner"
                      onChange={(event) => {
                        setSelectedOwnerId(event.target.value);
                        setOperationError(null);
                        setOperationSuccess(null);
                      }}
                      value={ownerValue}
                    >
                      <option value="">Unassigned</option>
                      {ticket.owner !== null &&
                      ownersQuery.data?.some(
                        (owner) => owner.id === ticket.owner?.id
                      ) !== true ? (
                        <option value={ticket.owner.id}>
                          {ticket.owner.displayName} (historical)
                        </option>
                      ) : null}
                      {ownersQuery.data?.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.displayName} · {owner.role}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <div className="form-field">
                    <span className="field-label">Owner action</span>
                    <button
                      className="button button-secondary"
                      disabled={
                        ticket.owner !== null ||
                        operationBusy ||
                        ownersQuery.isError
                      }
                      onClick={() => {
                        setOperationError(null);
                        setOperationSuccess(null);
                        claimMutation.mutate(ticket.version);
                      }}
                      type="button"
                    >
                      {claimMutation.isPending ? "Claiming…" : "Claim Ticket"}
                    </button>
                  </div>
                  <div className="form-field">
                    <span className="field-label">Save Owner</span>
                    <button
                      className="button button-primary"
                      disabled={
                        ownersQuery.isPending ||
                        ownersQuery.isError ||
                        operationBusy
                      }
                      onClick={() => {
                        const submittedOwnerValue = selectedOwnerId ?? "";
                        const ownerId =
                          submittedOwnerValue.length === 0
                            ? null
                            : Number(submittedOwnerValue);
                        setOperationError(null);
                        setOperationSuccess(null);
                        ownerMutation.mutate({
                          ownerId,
                          version: ticket.version,
                        });
                      }}
                      type="button"
                    >
                      {ownerMutation.isPending ? "Saving…" : "Save Owner"}
                    </button>
                  </div>
                  <FormField htmlFor="ticket-it-priority" label="IT Priority">
                    <select
                      disabled={operationBusy}
                      id="ticket-it-priority"
                      onChange={(event) => {
                        if (isRequestedPriority(event.target.value)) {
                          setSelectedItPriority(event.target.value);
                          setOperationError(null);
                          setOperationSuccess(null);
                        }
                      }}
                      value={itPriorityValue}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </FormField>
                  <div className="form-field">
                    <span className="field-label">Priority action</span>
                    <button
                      className="button button-primary"
                      disabled={operationBusy}
                      onClick={() => {
                        if (!isRequestedPriority(itPriorityValue)) {
                          return;
                        }

                        setOperationError(null);
                        setOperationSuccess(null);
                        priorityMutation.mutate({
                          itPriority: itPriorityValue,
                          version: ticket.version,
                        });
                      }}
                      type="button"
                    >
                      {priorityMutation.isPending
                        ? "Saving…"
                        : "Save IT Priority"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="context-note">
                  This Ticket is terminal. Owner and IT Priority changes are no
                  longer available.
                </p>
              )}

              {ownersQuery.isError ? (
                <div className="feedback feedback-warning" role="alert">
                  <strong>Owners unavailable.</strong>
                  <span>Retry before saving an assignment.</span>
                  <button
                    className="button button-secondary"
                    onClick={() => void ownersQuery.refetch()}
                    type="button"
                  >
                    Retry owners
                  </button>
                </div>
              ) : null}
              <div
                aria-live="polite"
                className="operation-status"
                role="status"
              >
                {operationSuccess === null ? null : (
                  <span className="success-message">{operationSuccess}</span>
                )}
                {operationError === null ? null : (
                  <span className="error-message">{operationError}</span>
                )}
              </div>
            </section>
          ) : null}

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
