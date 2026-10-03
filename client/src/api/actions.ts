import { getCsrfToken, apiClient } from "@/api/client";
import { ApiRequestError, invalidApiResponse, unwrap } from "@/api/errors";
import { isTicketDetail } from "@/api/ticket-response";
import {
  createApiTicketAction,
  getApiTicketActions,
} from "@/generated/hey-api/sdk.gen";
import type {
  ActionListResponse,
  ActionMutationResult as GeneratedActionMutationResult,
  ActionPageSize,
  ActionStatus,
  ActionTaken,
  ActionUserRef,
  CreateActionRequest,
  GetApiTicketActionsData,
  Owner,
  UserRole,
} from "@/generated/hey-api/types.gen";

export type TicketAction = ActionTaken;
export type TicketActionsPage = ActionListResponse;
export type CreateTicketActionInput = CreateActionRequest;
export type ActionMutationResult = GeneratedActionMutationResult;
export type TicketActionsListParams = Required<
  Pick<NonNullable<GetApiTicketActionsData["query"]>, "page" | "pageSize">
>;

const csrfHeaders = (): { "X-CSRF-Token": string } => {
  const token = getCsrfToken();
  if (token === null) {
    throw new ApiRequestError(
      401,
      "Sign in to continue.",
      "AUTHENTICATION_REQUIRED"
    );
  }

  return { "X-CSRF-Token": token };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isUserRole = (value: unknown): value is UserRole =>
  value === "Requester" || value === "IT Staff" || value === "Administrator";

const isUserRef = (value: unknown): value is ActionUserRef =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.displayName === "string" &&
  isUserRole(value.role);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isActionStatus = (value: unknown): value is ActionStatus =>
  value === "Planned" ||
  value === "In Progress" ||
  value === "Completed" ||
  value === "Cancelled";

const isActionAssignee = (value: unknown): value is Owner =>
  isRecord(value) &&
  typeof value.isActive === "boolean" &&
  typeof value.isEligible === "boolean" &&
  isUserRef(value);

// oxlint-disable-next-line complexity -- validate every generated ActionTaken field at this boundary.
const isTicketAction = (value: unknown): value is TicketAction =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  isPositiveSafeInteger(value.ticketId) &&
  typeof value.description === "string" &&
  isNullableString(value.result) &&
  isActionAssignee(value.assignee) &&
  isUserRef(value.createdBy) &&
  (value.performedBy === null || isUserRef(value.performedBy)) &&
  typeof value.followUpRequired === "boolean" &&
  isNullableString(value.followUpNote) &&
  isNullableString(value.attachmentNotes) &&
  isActionStatus(value.status) &&
  isPositiveSafeInteger(value.version) &&
  typeof value.createdAt === "string" &&
  typeof value.updatedAt === "string" &&
  isNullableString(value.startedAt) &&
  isNullableString(value.completedAt) &&
  (value.completedBy === null || isUserRef(value.completedBy)) &&
  isNullableString(value.cancelledAt) &&
  (value.cancelledBy === null || isUserRef(value.cancelledBy));

const isPageSize = (value: unknown): value is ActionPageSize =>
  value === 10 || value === 20 || value === 50;

const isTicketActionsPage = (value: unknown): value is TicketActionsPage =>
  isRecord(value) &&
  Array.isArray(value.items) &&
  value.items.every(isTicketAction) &&
  isPositiveSafeInteger(value.page) &&
  isPageSize(value.pageSize) &&
  isNonNegativeSafeInteger(value.totalItems) &&
  isNonNegativeSafeInteger(value.totalPages);

const isActionMutationResult = (
  value: unknown
): value is ActionMutationResult =>
  isRecord(value) &&
  isTicketAction(value.action) &&
  isTicketDetail(value.ticket);

export const getTicketActions = async (
  ticketId: number,
  params?: TicketActionsListParams,
  signal?: AbortSignal
): Promise<TicketActionsPage> => {
  const resolvedParams = params ?? { page: 1, pageSize: 20 };
  const body = await unwrap(
    getApiTicketActions({
      client: apiClient,
      path: { ticketId },
      query: resolvedParams,
      signal,
    })
  );

  if (!isTicketActionsPage(body)) {
    throw invalidApiResponse(
      "The API returned an invalid Actions Taken response."
    );
  }

  return body;
};

const toCreateBody = (input: CreateTicketActionInput): CreateActionRequest => {
  const body: CreateActionRequest = {
    description: input.description,
    followUpRequired: input.followUpRequired,
    requestId: input.requestId,
    version: input.version,
  };

  if (input.result !== null && input.result !== undefined) {
    body.result = input.result;
  }
  if (input.assigneeId !== undefined && input.assigneeId !== null) {
    body.assigneeId = input.assigneeId;
  }
  if (input.followUpNote !== null && input.followUpNote !== undefined) {
    body.followUpNote = input.followUpNote;
  }
  if (input.attachmentNotes !== null && input.attachmentNotes !== undefined) {
    body.attachmentNotes = input.attachmentNotes;
  }

  return body;
};

export const createTicketAction = async (
  ticketId: number,
  input: CreateTicketActionInput,
  signal?: AbortSignal
): Promise<ActionMutationResult> => {
  const body = await unwrap(
    createApiTicketAction({
      body: toCreateBody(input),
      client: apiClient,
      headers: csrfHeaders(),
      path: { ticketId },
      signal,
    })
  );

  if (!isActionMutationResult(body)) {
    throw invalidApiResponse(
      "The API returned an invalid Actions Taken mutation response."
    );
  }

  return body;
};
