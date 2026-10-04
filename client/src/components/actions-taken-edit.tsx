import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { refreshActionMutationQueries } from "@/api/action-mutation-cache";
import { editTicketAction, getTicketActions } from "@/api/actions";
import type { TicketAction, TicketActionsListParams } from "@/api/actions";
import { ApiRequestError } from "@/api/errors";
import { getTicket } from "@/api/requester";
import { ActionForm } from "@/components/action-form";
import type { Owner, UserRole } from "@/generated/hey-api/types.gen";
import {
  getActionFieldErrors,
  normalizeActionForm,
  validateActionForm,
} from "@/lib/action-rules";
import type { ActionFieldErrors, ActionFormValues } from "@/lib/action-rules";
import type { CurrentStatus } from "@/lib/ticket-statuses";

export interface ActionInteractionContext {
  currentStatus: CurrentStatus;
  onRetryAssignees?: () => Promise<unknown>;
  owners: readonly Owner[];
  ownersError: Error | null;
  ownersLoading: boolean;
  params: TicketActionsListParams;
  principalId: number;
  principalRole: UserRole;
  ticketId: number;
  ticketVersion: number;
}

export const canEditAction = (
  status: TicketAction["status"],
  ticketStatus: CurrentStatus
): boolean =>
  (status === "Planned" || status === "In Progress") &&
  ticketStatus !== "Resolved" &&
  ticketStatus !== "Closed" &&
  ticketStatus !== "Cancelled";

const formFromAction = (action: TicketAction): ActionFormValues => ({
  assigneeId: String(action.assignee.id),
  attachmentNotes: action.attachmentNotes ?? "",
  description: action.description,
  followUpNote: action.followUpNote ?? "",
  followUpRequired: action.followUpRequired,
  result: action.result ?? "",
});

const editErrorMessage = (error: unknown): string => {
  if (error instanceof ApiRequestError) {
    if (error.code === "VERSION_CONFLICT") {
      return "The saved action or Ticket changed. Your draft is preserved. Refresh and review before saving again.";
    }
    if (error.status === 403) {
      return "You are not allowed to edit this action. Your draft is preserved.";
    }
    if (error.status === 404) {
      return "This Ticket or action was not found. Your draft is preserved.";
    }
  }
  return `${error instanceof Error ? error.message : "Unable to save the action."} Your draft is preserved.`;
};

export const ActionEditPanel = ({
  action,
  context,
  mode,
  onClose,
}: {
  action: TicketAction;
  context: ActionInteractionContext;
  mode: "Edit" | "Assign";
  onClose: (saved: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => formFromAction(action));
  const [baseline, setBaseline] = useState(() => ({
    action,
    draftAssignee: action.assignee,
    ticketVersion: context.ticketVersion,
  }));
  const [fieldErrors, setFieldErrors] = useState<ActionFieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeRef.current = true;
    formRef.current
      ?.querySelector<HTMLElement>(
        mode === "Assign" ? '[name="assigneeId"]' : '[name="description"]'
      )
      ?.focus();
    return () => {
      activeRef.current = false;
      abortRef.current?.abort();
    };
  }, [mode]);

  const editable = canEditAction(baseline.action.status, context.currentStatus);
  const setField = <K extends keyof ActionFormValues>(
    field: K,
    value: ActionFormValues[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current || conflict || !editable) {
      return;
    }
    const errors = validateActionForm(form);
    setFieldErrors(errors);
    const [firstInvalid] = Object.keys(errors);
    if (firstInvalid !== undefined) {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
        ?.focus();
      return;
    }
    const normalized = normalizeActionForm(form);
    if (normalized.assigneeId === undefined) {
      return;
    }
    if (
      normalized.assigneeId !== baseline.action.assignee.id &&
      !context.owners.some(
        (owner) =>
          owner.id === normalized.assigneeId &&
          owner.isActive &&
          owner.isEligible
      )
    ) {
      setFieldErrors({
        assigneeId: "Choose an active IT Staff member or Administrator.",
      });
      formRef.current
        ?.querySelector<HTMLElement>('[name="assigneeId"]')
        ?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await editTicketAction(
        context.ticketId,
        action.id,
        {
          ...normalized,
          actionVersion: baseline.action.version,
          assigneeId: normalized.assigneeId,
          ticketVersion: baseline.ticketVersion,
        },
        controller.signal
      );
      if (!activeRef.current) {
        return;
      }
      await refreshActionMutationQueries(
        queryClient,
        result,
        context.principalId,
        context.principalRole
      );
      if (activeRef.current) {
        onClose(true);
      }
    } catch (error: unknown) {
      if (!activeRef.current) {
        return;
      }
      const apiErrors = getActionFieldErrors(error);
      setFieldErrors(apiErrors);
      setFailure(editErrorMessage(error));
      setConflict(
        error instanceof ApiRequestError && error.code === "VERSION_CONFLICT"
      );
    } finally {
      if (activeRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const refresh = async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const [page, ticket] = await Promise.all([
        getTicketActions(context.ticketId, context.params, controller.signal),
        getTicket(context.ticketId, controller.signal),
      ]);
      if (!activeRef.current) {
        return;
      }
      const latest = page.items.find((item) => item.id === action.id);
      if (latest === undefined) {
        throw new Error(
          "The action is no longer on this page. Cancel and refresh the list."
        );
      }
      queryClient.setQueryData(
        ["ticket", context.principalId, context.ticketId],
        ticket
      );
      queryClient.setQueryData(
        [
          "ticket-actions",
          context.principalId,
          context.principalRole,
          context.ticketId,
          context.params.page,
          context.params.pageSize,
        ],
        page
      );
      setBaseline((current) => ({
        ...current,
        action: latest,
        ticketVersion: ticket.version,
      }));
      setConflict(false);
      setFailure(null);
      setReviewed(true);
    } catch (error: unknown) {
      if (activeRef.current) {
        setFailure(editErrorMessage(error));
      }
    } finally {
      if (activeRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <div className="action-create-panel">
      <h4>
        {mode} Action Taken #{action.id}
      </h4>
      <p className="action-meta">
        Save is attributed to the signed-in user. Assignment does not change
        Ticket Owner or Performed by.
      </p>
      {baseline.action.assignee.isEligible ? null : (
        <p className="feedback feedback-warning">
          Current assignee {baseline.action.assignee.displayName} is ineligible.
          You may retain this identity while editing; reassign before starting
          or completing work.
        </p>
      )}
      {editable ? null : (
        <p className="feedback feedback-warning" role="alert">
          This action or Ticket is no longer editable. Your draft is preserved.
        </p>
      )}
      {reviewed ? (
        <div className="feedback feedback-warning action-review" role="status">
          <h4>Latest saved values</h4>
          <p>
            Your draft is unchanged. Review these saved values before choosing
            Save Action Taken.
          </p>
          <dl className="action-details">
            <div>
              <dt>Action Description</dt>
              <dd className="action-read-text">
                {baseline.action.description}
              </dd>
            </div>
            <div>
              <dt>Result</dt>
              <dd className="action-read-text">
                {baseline.action.result ?? "—"}
              </dd>
            </div>
            <div>
              <dt>Assignee</dt>
              <dd>
                {baseline.action.assignee.displayName} ·{" "}
                {baseline.action.assignee.role}
              </dd>
            </div>
            <div>
              <dt>Follow-Up Required</dt>
              <dd>{baseline.action.followUpRequired ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Follow-up Note</dt>
              <dd className="action-read-text">
                {baseline.action.followUpNote ?? "—"}
              </dd>
            </div>
            <div>
              <dt>Attachment Notes</dt>
              <dd className="action-read-text">
                {baseline.action.attachmentNotes ?? "—"}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{baseline.action.status}</dd>
            </div>
            <div>
              <dt>Versions</dt>
              <dd>
                Action {baseline.action.version} · Ticket{" "}
                {baseline.ticketVersion}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      <ActionForm
        error={failure}
        fieldErrors={fieldErrors}
        form={form}
        formRef={formRef}
        idPrefix={`action-edit-${action.id}`}
        currentAssignee={baseline.action.assignee}
        draftAssignee={baseline.draftAssignee}
        isSubmitting={busy}
        onCancel={() => {
          onClose(false);
        }}
        onChange={setField}
        onSubmit={(event) => void submit(event)}
        onRetryAssignees={
          context.onRetryAssignees === undefined
            ? undefined
            : async () => await context.onRetryAssignees?.()
        }
        owners={context.owners}
        ownersError={context.ownersError}
        ownersLoading={context.ownersLoading}
        saveDisabled={conflict || !editable}
      />
      {failure === null ? null : (
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => void refresh()}
          type="button"
        >
          Refresh and review
        </button>
      )}
    </div>
  );
};
