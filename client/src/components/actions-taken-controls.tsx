import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { refreshActionMutationQueries } from "@/api/action-mutation-cache";
import { getTicketActions, transitionTicketAction } from "@/api/actions";
import type { ActionMutationResult, TicketAction } from "@/api/actions";
import { ApiRequestError } from "@/api/errors";
import { getTicket } from "@/api/requester";
import {
  ActionEditPanel,
  canEditAction,
} from "@/components/actions-taken-edit";
import type { ActionInteractionContext } from "@/components/actions-taken-edit";
import { ActionHistory } from "@/components/actions-taken-history";

type TerminalActionStatus = "Completed" | "Cancelled";
type ActionTransitionTarget = "In Progress" | TerminalActionStatus;

const focusableDialogSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const lifecycleErrorMessage = (error: unknown): string => {
  if (error instanceof ApiRequestError) {
    if (error.code === "VERSION_CONFLICT") {
      return "The Action Taken or Ticket changed. Refresh the page and review the latest values before you retry.";
    }
    if (error.code === "ACTION_ASSIGNEE_INELIGIBLE") {
      return "Assign this Action Taken to an active IT Staff member or Administrator before you start or complete it.";
    }
    if (error.code === "RESULT_REQUIRED") {
      return "Add a Result before you complete this Action Taken.";
    }
    if (error.code === "FOLLOW_UP_UNRESOLVED") {
      return "Clear or correct the follow-up details before you complete this Action Taken.";
    }
    if (error.code === "ACTION_TERMINAL") {
      return "This Action Taken is Completed or Cancelled. You cannot change it.";
    }
    if (error.code === "TICKET_TERMINAL") {
      return "You cannot change Actions Taken on a Resolved, Closed, or Cancelled Ticket.";
    }
    if (error.status === 403) {
      return "You cannot change Actions Taken.";
    }
    if (error.status === 404) {
      return "This Ticket or Action Taken was not found.";
    }
    return error.message;
  }

  return error instanceof Error && error.message.length > 0
    ? error.message
    : "You could not change this Action Taken. Refresh the page and review the saved values before you retry.";
};

const successMessage = (target: ActionTransitionTarget): string => {
  if (target === "In Progress") {
    return "Action Taken started.";
  }
  if (target === "Completed") {
    return "Action Taken completed.";
  }
  return "Action Taken cancelled.";
};

const completionBlockedReason = (
  hasResult: boolean,
  followUpRequired: boolean,
  assigneeEligible: boolean
): string | null => {
  if (!hasResult) {
    return "Add a Result before completion. Edit this Action Taken to record the outcome.";
  }
  if (followUpRequired) {
    return "Clear or correct the follow-up details before completion.";
  }
  if (assigneeEligible) {
    return null;
  }
  return "Assign this Action Taken to active eligible staff before completion.";
};

// oxlint-disable-next-line complexity -- This component renders lifecycle actions, confirmation, and recovery states.
const ActionLifecycleControls = ({
  action,
  context,
}: {
  action: TicketAction;
  context: ActionInteractionContext;
}) => {
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState<TerminalActionStatus | null>(
    null
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogCancelRef = useRef<HTMLButtonElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const failureRef = useRef<HTMLDivElement | null>(null);
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  const wasDialogOpen = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const staff =
    context.principalRole === "IT Staff" ||
    context.principalRole === "Administrator";
  const activeTicket =
    context.currentStatus !== "Resolved" &&
    context.currentStatus !== "Closed" &&
    context.currentStatus !== "Cancelled";
  const pendingAction =
    action.status === "Planned" || action.status === "In Progress";
  const canProgress = staff && activeTicket && pendingAction;
  const assigneeEligible =
    action.assignee.isActive && action.assignee.isEligible;
  const hasResult = action.result !== null && action.result.trim().length > 0;
  const completeDisabled =
    busy || !assigneeEligible || !hasResult || action.followUpRequired;

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        setConfirmation(null);
        setFailure(null);
        return;
      }

      if (event.key !== "Tab" || dialogRef.current === null) {
        return;
      }

      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          focusableDialogSelector
        ),
      ];
      const [first, ...rest] = focusable;
      const last = rest.at(-1);
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }

      const { activeElement } = document;
      if (
        event.shiftKey &&
        (activeElement === first || !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === last || !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    if (confirmation === null) {
      if (wasDialogOpen.current) {
        if (success === null) {
          triggerRef.current?.focus();
        } else {
          statusRef.current?.focus();
        }
      }
      wasDialogOpen.current = false;
    } else {
      wasDialogOpen.current = true;
      dialogCancelRef.current?.focus();
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmation, success]);

  useEffect(() => {
    if (failure !== null) {
      failureRef.current?.focus();
    }
  }, [failure]);

  const applyTransition = async (target: ActionTransitionTarget) => {
    if (busyRef.current || !canProgress) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    setSuccess(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const input =
        target === "In Progress"
          ? {
              actionVersion: action.version,
              ticketVersion: context.ticketVersion,
              toStatus: target,
            }
          : {
              actionVersion: action.version,
              confirmed: true as const,
              ticketVersion: context.ticketVersion,
              toStatus: target,
            };
      const result = await transitionTicketAction(
        context.ticketId,
        action.id,
        input,
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
      if (!activeRef.current) {
        return;
      }
      setSuccess(successMessage(target));
      setConfirmation(null);
      statusRef.current?.focus();
    } catch (error: unknown) {
      if (activeRef.current) {
        setFailure(lifecycleErrorMessage(error));
      }
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
    setFailure(null);
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
          "This action is no longer on the current page. Refresh the action list."
        );
      }
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
      const result: ActionMutationResult = { action: latest, ticket };
      await refreshActionMutationQueries(
        queryClient,
        result,
        context.principalId,
        context.principalRole
      );
      if (!activeRef.current) {
        return;
      }
      setSuccess(
        "Latest Action Taken values are ready. Review them before you retry."
      );
      setConfirmation(null);
    } catch (error: unknown) {
      if (activeRef.current) {
        setFailure(lifecycleErrorMessage(error));
      }
    } finally {
      if (activeRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const blockedCompletionReason = completionBlockedReason(
    hasResult,
    action.followUpRequired,
    assigneeEligible
  );
  const dialogTitle = `Confirm ${confirmation === "Completed" ? "completion" : "cancellation"} of Action Taken #${action.id}?`;
  const dialogDescription =
    confirmation === "Completed"
      ? "After completion, you cannot edit or change this Action Taken. The Result and event history will remain on the Ticket."
      : "After cancellation, you cannot edit or change this Action Taken. The cancellation record will remain on the Ticket.";
  const failureFeedback =
    failure === null ? null : (
      <div
        aria-live="assertive"
        className="feedback feedback-error"
        ref={failureRef}
        role="alert"
        tabIndex={-1}
      >
        <p>{failure}</p>
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => void refresh()}
          type="button"
        >
          Refresh and review
        </button>
      </div>
    );

  return (
    <>
      {canProgress ? (
        <div className="form-actions action-lifecycle-actions">
          {action.status === "Planned" ? (
            <>
              <button
                className="button button-primary"
                disabled={busy || !assigneeEligible}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  void applyTransition("In Progress");
                }}
                type="button"
              >
                Start Action Taken #{action.id}
              </button>
              <button
                className="button button-danger"
                disabled={busy}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setFailure(null);
                  setSuccess(null);
                  setConfirmation("Cancelled");
                }}
                type="button"
              >
                Cancel Action Taken #{action.id}
              </button>
            </>
          ) : (
            <>
              <button
                className="button button-primary"
                disabled={completeDisabled}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setFailure(null);
                  setSuccess(null);
                  setConfirmation("Completed");
                }}
                type="button"
              >
                Complete Action Taken #{action.id}
              </button>
              <button
                className="button button-danger"
                disabled={busy}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setFailure(null);
                  setSuccess(null);
                  setConfirmation("Cancelled");
                }}
                type="button"
              >
                Cancel Action Taken #{action.id}
              </button>
            </>
          )}
        </div>
      ) : null}
      {canProgress && action.status === "Planned" && !assigneeEligible ? (
        <p className="feedback feedback-warning">
          Assign this Action Taken to an active IT Staff member or Administrator
          before starting it.
        </p>
      ) : null}
      {canProgress &&
      action.status === "In Progress" &&
      blockedCompletionReason !== null ? (
        <p className="feedback feedback-warning">{blockedCompletionReason}</p>
      ) : null}
      <div
        aria-live="polite"
        className="operation-status"
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        {success}
      </div>
      {confirmation === null ? failureFeedback : null}
      {confirmation === null ? null : (
        <div
          aria-describedby={`action-transition-${action.id}-description`}
          aria-labelledby={`action-transition-${action.id}-title`}
          aria-modal="true"
          className="dialog-backdrop"
          role="alertdialog"
        >
          <div className="surface-card confirmation-dialog" ref={dialogRef}>
            <p className="eyebrow">Confirm Action Taken change</p>
            <h2 id={`action-transition-${action.id}-title`}>{dialogTitle}</h2>
            <p id={`action-transition-${action.id}-description`}>
              {dialogDescription}
            </p>
            {failureFeedback}
            <div className="form-actions">
              <button
                className="button button-secondary"
                disabled={busy}
                ref={dialogCancelRef}
                onClick={() => {
                  setConfirmation(null);
                  setFailure(null);
                }}
                type="button"
              >
                Keep Action Taken
              </button>
              <button
                className="button button-danger"
                disabled={busy}
                onClick={() => void applyTransition(confirmation)}
                type="button"
              >
                {busy
                  ? "Saving…"
                  : `Confirm ${confirmation === "Completed" ? "completion" : "cancellation"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const ActionControls = ({
  action,
  context,
}: {
  action: TicketAction;
  context: ActionInteractionContext;
}) => {
  const [mode, setMode] = useState<"Edit" | "Assign" | null>(null);
  const [success, setSuccess] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);
  const staff =
    context.principalRole === "IT Staff" ||
    context.principalRole === "Administrator";

  useEffect(() => {
    if (mode === null && wasEditing.current) {
      triggerRef.current?.focus();
    }
    wasEditing.current = mode !== null;
  }, [mode]);

  return (
    <>
      {staff && canEditAction(action.status, context.currentStatus) ? (
        <div className="form-actions">
          {(["Edit", "Assign"] as const).map((label) => (
            <button
              className="button button-secondary"
              disabled={mode !== null}
              key={label}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setSuccess(false);
                setMode(label);
              }}
              type="button"
            >
              {label} Action Taken #{action.id}
            </button>
          ))}
        </div>
      ) : null}
      {mode === null ? null : (
        <ActionEditPanel
          action={action}
          context={context}
          mode={mode}
          onClose={(saved) => {
            setMode(null);
            setSuccess(saved);
          }}
        />
      )}
      <ActionLifecycleControls action={action} context={context} />
      <div aria-live="polite" className="operation-status" role="status">
        {success ? "Action Taken saved successfully." : null}
      </div>
      <ActionHistory
        actionId={action.id}
        currentAssignee={action.assignee}
        context={context}
      />
    </>
  );
};
