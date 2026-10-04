import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { refreshActionMutationQueries } from "@/api/action-mutation-cache";
import { createTicketAction } from "@/api/actions";
import type { ActionMutationResult, TicketAction } from "@/api/actions";
import { ApiConnectionError } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import type { UserRole } from "@/generated/hey-api/types.gen";
import {
  getActionFieldErrors,
  normalizeActionForm,
  validateActionForm,
} from "@/lib/action-rules";
import type {
  ActionFieldErrors,
  ActionFormValues,
  NormalizedActionForm,
} from "@/lib/action-rules";
import type { CurrentStatus } from "@/lib/ticket-statuses";

const terminalTicketStatuses = new Set<CurrentStatus>([
  "Resolved",
  "Closed",
  "Cancelled",
]);
const actionFieldNames: readonly (keyof ActionFormValues)[] = [
  "description",
  "result",
  "assigneeId",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
];

type CreateFailureKind = "other" | "uncertain" | "version-conflict";

interface CreateFailure {
  kind: CreateFailureKind;
  message: string;
}

export interface UseActionsTakenCreateOptions {
  currentStatus: CurrentStatus;
  defaultAssigneeId: number;
  principalId: number;
  principalRole: UserRole;
  ticketId: number;
  ticketVersion: number;
}

const createInitialForm = (defaultAssigneeId: number): ActionFormValues => ({
  assigneeId: String(defaultAssigneeId),
  attachmentNotes: "",
  description: "",
  followUpNote: "",
  followUpRequired: false,
  result: "",
});

const formFromNormalized = (
  values: NormalizedActionForm
): ActionFormValues => ({
  assigneeId: values.assigneeId === undefined ? "" : String(values.assigneeId),
  attachmentNotes: values.attachmentNotes ?? "",
  description: values.description,
  followUpNote: values.followUpNote ?? "",
  followUpRequired: values.followUpRequired,
  result: values.result ?? "",
});

const sameNormalizedForm = (
  first: NormalizedActionForm,
  second: NormalizedActionForm
): boolean =>
  first.assigneeId === second.assigneeId &&
  first.attachmentNotes === second.attachmentNotes &&
  first.description === second.description &&
  first.followUpNote === second.followUpNote &&
  first.followUpRequired === second.followUpRequired &&
  first.result === second.result;

const createRequestId = (): string => globalThis.crypto.randomUUID();

const getCreateErrorMessage = (error: unknown): string => {
  if (error instanceof ApiRequestError && error.code === "VERSION_CONFLICT") {
    return "This Ticket changed while the action was being created. Refresh the latest Ticket and review your draft.";
  }

  if (error instanceof ApiRequestError && error.status === 403) {
    return "You are not allowed to create an Action Taken on this Ticket.";
  }

  if (error instanceof ApiRequestError && error.status === 404) {
    return "This Ticket was not found. Your draft is still available.";
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to save the Action Taken. Your draft is still available.";
};

const isUncertainCreateFailure = (error: unknown): boolean =>
  error instanceof ApiConnectionError ||
  (error instanceof ApiRequestError && error.status >= 500);

const isStaffRole = (role: UserRole): boolean =>
  role === "IT Staff" || role === "Administrator";

export const useActionsTakenCreate = ({
  currentStatus,
  defaultAssigneeId,
  principalId,
  principalRole,
  ticketId,
  ticketVersion,
}: UseActionsTakenCreateOptions) => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<ActionFormValues>(() =>
    createInitialForm(defaultAssigneeId)
  );
  const [fieldErrors, setFieldErrors] = useState<ActionFieldErrors>({});
  const [createFailure, setCreateFailure] = useState<CreateFailure | null>(
    null
  );
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [savedAction, setSavedAction] = useState<TicketAction | null>(null);
  const submitLockRef = useRef(false);
  const identityGenerationRef = useRef(0);
  const requestIdRef = useRef<string | null>(null);
  const originalDraftRef = useRef<NormalizedActionForm | null>(null);
  const originalVersionRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // oxlint-disable react/react-compiler -- reset local draft state when the authenticated Ticket identity changes.
  useEffect(() => {
    identityGenerationRef.current += 1;
    submitLockRef.current = false;
    setIsSubmitting(false);
    setIsCreateOpen(false);
    setForm(createInitialForm(defaultAssigneeId));
    setFieldErrors({});
    setCreateFailure(null);
    setCreateSuccess(null);
    setUncertain(false);
    setSavedAction(null);
    requestIdRef.current = null;
    originalDraftRef.current = null;
    originalVersionRef.current = null;
    return () => {
      identityGenerationRef.current += 1;
    };
  }, [defaultAssigneeId, principalId, principalRole, ticketId]);
  // oxlint-enable react/react-compiler

  const canCreate =
    isStaffRole(principalRole) && !terminalTicketStatuses.has(currentStatus);

  const setField = <K extends keyof ActionFormValues>(
    field: K,
    value: ActionFormValues[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!(field in current)) {
        return current;
      }

      const next = { ...current };
      Reflect.deleteProperty(next, field);
      return next;
    });
    setCreateFailure(null);
  };

  const resetRequestIdentity = () => {
    requestIdRef.current = null;
    originalDraftRef.current = null;
    originalVersionRef.current = null;
    setUncertain(false);
  };

  const closeCreateForm = () => {
    if (isSubmitting) {
      return;
    }

    setIsCreateOpen(false);
    setForm(createInitialForm(defaultAssigneeId));
    setFieldErrors({});
    setCreateFailure(null);
    resetRequestIdentity();
  };

  const openCreateForm = () => {
    setForm(createInitialForm(defaultAssigneeId));
    setFieldErrors({});
    setCreateFailure(null);
    setCreateSuccess(null);
    setSavedAction(null);
    resetRequestIdentity();
    setIsCreateOpen(true);
  };

  const retryOriginalAction = () => {
    if (originalDraftRef.current === null) {
      return;
    }

    setForm(formFromNormalized(originalDraftRef.current));
    setFieldErrors({});
    setCreateFailure(null);
  };

  const focusFirstInvalidField = (errors: ActionFieldErrors) => {
    for (const field of actionFieldNames) {
      if (errors[field] !== undefined) {
        formRef.current
          ?.querySelector<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          >(`[name="${field}"]`)
          ?.focus();
        return;
      }
    }
  };

  const handleCreateSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitLockRef.current) {
      return;
    }

    const nextFieldErrors = validateActionForm(form);
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      focusFirstInvalidField(nextFieldErrors);
      return;
    }

    const currentDraft = normalizeActionForm(form);
    if (
      uncertain &&
      originalDraftRef.current !== null &&
      !sameNormalizedForm(currentDraft, originalDraftRef.current)
    ) {
      setCreateFailure({
        kind: "uncertain",
        message:
          "The previous request may have succeeded. Restore the original draft before retrying with its request ID.",
      });
      return;
    }

    const requestId = requestIdRef.current ?? createRequestId();
    const originalDraft = originalDraftRef.current ?? currentDraft;
    const version = originalVersionRef.current ?? ticketVersion;
    requestIdRef.current = requestId;
    originalDraftRef.current = originalDraft;
    originalVersionRef.current = version;

    const identityGeneration = identityGenerationRef.current;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setFieldErrors({});
    setCreateFailure(null);
    setCreateSuccess(null);

    const submittedDraft =
      uncertain && originalDraftRef.current !== null
        ? originalDraftRef.current
        : currentDraft;

    try {
      const result: ActionMutationResult = await createTicketAction(ticketId, {
        ...submittedDraft,
        requestId,
        version,
      });
      if (identityGenerationRef.current !== identityGeneration) {
        return;
      }
      setSavedAction(result.action);
      setCreateSuccess("Action Taken saved successfully.");
      await refreshActionMutationQueries(
        queryClient,
        result,
        principalId,
        principalRole
      );
      if (identityGenerationRef.current !== identityGeneration) {
        return;
      }
      setIsCreateOpen(false);
      setForm(createInitialForm(defaultAssigneeId));
      setFieldErrors({});
      resetRequestIdentity();
    } catch (error: unknown) {
      if (identityGenerationRef.current !== identityGeneration) {
        return;
      }
      const apiFieldErrors = getActionFieldErrors(error);
      setFieldErrors(apiFieldErrors);
      if (isUncertainCreateFailure(error)) {
        setUncertain(true);
        setCreateFailure({
          kind: "uncertain",
          message:
            "The request may have succeeded. Restore the original draft before retrying with the same request ID.",
        });
      } else {
        const isVersionConflict =
          error instanceof ApiRequestError && error.code === "VERSION_CONFLICT";
        setCreateFailure({
          kind: isVersionConflict ? "version-conflict" : "other",
          message: getCreateErrorMessage(error),
        });
        resetRequestIdentity();
      }
    } finally {
      if (identityGenerationRef.current === identityGeneration) {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  return {
    canCreate,
    createFailure,
    createSuccess,
    fieldErrors,
    form,
    formRef,
    handleCloseCreateForm: closeCreateForm,
    handleCreateSubmit,
    handleOpenCreateForm: openCreateForm,
    handleRetryOriginalAction: retryOriginalAction,
    handleSetField: setField,
    isCreateOpen,
    isSubmitting,
    savedAction,
    uncertain,
  };
};
