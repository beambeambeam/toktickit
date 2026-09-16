import { apiClient, getCsrfToken } from "@/api/client";
import { ApiRequestError, invalidApiResponse, unwrap } from "@/api/errors";
import {
  claimApiTicket,
  getApiStaffOwners,
  getApiStaffTickets,
  updateApiTicketStatus,
  updateApiTicketItPriority,
  updateApiTicketOwner,
} from "@/generated/hey-api/sdk.gen";
import type {
  CurrentStatus,
  ItPriorityMutationRequest,
  OperationalTicketSummary,
  Owner,
  OwnerListResponse,
  OwnerMutationRequest,
  QueuePageSize,
  QueueSortBy,
  RequestedPriority,
  StaffTicketListResponse,
  StatusMutationRequest,
  TicketDetail,
  TicketVersionRequest,
} from "@/generated/hey-api/types.gen";
import { isRequestedPriority } from "@/lib/ticket-priorities";
import { isCurrentStatus } from "@/lib/ticket-statuses";

export type StaffTicketOwnerFilter = number | "me" | "unassigned";

export interface StaffTicketListParams {
  categoryId?: number;
  currentStatus?: CurrentStatus;
  itPriority?: RequestedPriority;
  owner?: StaffTicketOwnerFilter;
  page?: number;
  pageSize?: QueuePageSize;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  search?: string;
  sortBy?: QueueSortBy;
  sortDirection?: "asc" | "desc";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const requireTicketDetail = (value: TicketDetail): TicketDetail => value;

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isNamedReference = (
  value: unknown
): value is { id: number; name: string } =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.name === "string";

const isOwnerRole = (value: unknown): value is Owner["role"] =>
  value === "Requester" || value === "IT Staff" || value === "Administrator";

const isOwner = (value: unknown): value is Owner =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.displayName === "string" &&
  isOwnerRole(value.role) &&
  typeof value.isActive === "boolean" &&
  typeof value.isEligible === "boolean";

const isTicketSummary = (value: unknown): value is OperationalTicketSummary =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.ticketNumber === "string" &&
  typeof value.ticketDate === "string" &&
  typeof value.summary === "string" &&
  isNamedReference(value.category) &&
  isNamedReference(value.relatedSystem) &&
  isRequestedPriority(value.requestedPriority) &&
  isCurrentStatus(value.currentStatus) &&
  typeof value.updatedAt === "string" &&
  isRequestedPriority(value.itPriority) &&
  (value.owner === null || isOwner(value.owner)) &&
  isPositiveSafeInteger(value.version);

const isPageSize = (value: unknown): value is QueuePageSize =>
  value === 10 || value === 20 || value === 50;

const isStaffTicketListResponse = (
  value: unknown
): value is StaffTicketListResponse =>
  isRecord(value) &&
  Array.isArray(value.items) &&
  value.items.every(isTicketSummary) &&
  isPositiveSafeInteger(value.page) &&
  isPageSize(value.pageSize) &&
  isNonNegativeSafeInteger(value.totalItems) &&
  isNonNegativeSafeInteger(value.totalPages);

const isOwnerListResponse = (value: unknown): value is OwnerListResponse =>
  isRecord(value) && Array.isArray(value.items) && value.items.every(isOwner);

export const getStaffTickets = async (
  params: StaffTicketListParams,
  signal?: AbortSignal
): Promise<StaffTicketListResponse> => {
  const body = await unwrap(
    getApiStaffTickets({
      client: apiClient,
      query: params,
      signal,
    })
  );

  if (!isStaffTicketListResponse(body)) {
    throw invalidApiResponse(
      "The API returned an invalid shared Ticket Queue response."
    );
  }

  return body;
};

export const getStaffOwners = async (
  signal?: AbortSignal
): Promise<Owner[]> => {
  const body = await unwrap(
    getApiStaffOwners({
      client: apiClient,
      signal,
    })
  );

  if (!isOwnerListResponse(body)) {
    throw invalidApiResponse(
      "The API returned an invalid Ticket Owner response."
    );
  }

  return body.items;
};

export const updateStaffTicketStatus = async (
  ticketId: number,
  input: StatusMutationRequest,
  signal?: AbortSignal
): Promise<TicketDetail> =>
  requireTicketDetail(
    await unwrap(
      updateApiTicketStatus({
        body: input,
        client: apiClient,
        headers: csrfHeaders(),
        path: { ticketId },
        signal,
      })
    )
  );

export const claimStaffTicket = async (
  ticketId: number,
  input: TicketVersionRequest,
  signal?: AbortSignal
): Promise<TicketDetail> =>
  requireTicketDetail(
    await unwrap(
      claimApiTicket({
        body: input,
        client: apiClient,
        headers: csrfHeaders(),
        path: { ticketId },
        signal,
      })
    )
  );

export const updateStaffTicketOwner = async (
  ticketId: number,
  input: OwnerMutationRequest,
  signal?: AbortSignal
): Promise<TicketDetail> =>
  requireTicketDetail(
    await unwrap(
      updateApiTicketOwner({
        body: input,
        client: apiClient,
        headers: csrfHeaders(),
        path: { ticketId },
        signal,
      })
    )
  );

export const updateStaffTicketItPriority = async (
  ticketId: number,
  input: ItPriorityMutationRequest,
  signal?: AbortSignal
): Promise<TicketDetail> =>
  requireTicketDetail(
    await unwrap(
      updateApiTicketItPriority({
        body: input,
        client: apiClient,
        headers: csrfHeaders(),
        path: { ticketId },
        signal,
      })
    )
  );
