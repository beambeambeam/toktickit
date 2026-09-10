import { getCsrfToken, apiClient } from "@/api/client";
import {
  ApiRequestError,
  invalidApiResponse,
  unwrap,
  unwrapWithResponse,
} from "@/api/errors";
import {
  createApiTicket,
  createApiTicketAttachments,
  getApiRelatedSystems,
  getApiTicket,
  getApiTicketAttachmentContent,
  getApiTickets,
  removeApiTicketAttachment,
} from "@/generated/hey-api/sdk.gen";
import type {
  AttachmentMetadata,
  RelatedSystem,
  TicketDetail,
  TicketListResponse,
  TicketSummary,
} from "@/generated/hey-api/types.gen";
import { isRequestedPriority } from "@/lib/ticket-priorities";

export { ApiRequestError } from "@/api/errors";

export interface TicketListParams {
  categoryId?: number;
  currentStatus?: "New";
  page?: number;
  pageSize?: 10 | 25 | 50;
  relatedSystemId?: number;
  requestedPriority?: "Low" | "Medium" | "High" | "Urgent";
  search?: string;
  sortBy?:
    | "ticketNumber"
    | "ticketDate"
    | "summary"
    | "requestedPriority"
    | "currentStatus"
    | "updatedAt";
  sortDirection?: "asc" | "desc";
}

export interface CreateTicketInput {
  attachments: readonly File[];
  categoryId: number;
  description: string;
  relatedSystemId: number;
  requestedPriority: "Low" | "Medium" | "High" | "Urgent";
  summary: string;
}

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

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

const isNamedReference = (
  value: unknown
): value is { id: number; name: string } =>
  isRecord(value) &&
  typeof value.id === "number" &&
  Number.isSafeInteger(value.id) &&
  value.id > 0 &&
  typeof value.name === "string";

const isCurrentStatus = (
  value: unknown
): value is TicketSummary["currentStatus"] => value === "New";

const isPageSize = (value: unknown): value is TicketListResponse["pageSize"] =>
  value === 10 || value === 25 || value === 50;

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isAttachmentMetadata = (value: unknown): value is AttachmentMetadata =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.originalFilename === "string" &&
  typeof value.mediaType === "string" &&
  isNonNegativeSafeInteger(value.byteSize) &&
  typeof value.uploadedAt === "string" &&
  (value.state === "Active" || value.state === "Removed") &&
  (value.removedAt === null || typeof value.removedAt === "string") &&
  (value.removalReason === null || typeof value.removalReason === "string");

const isTicketSummary = (value: unknown): value is TicketSummary =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.ticketNumber === "string" &&
  typeof value.ticketDate === "string" &&
  typeof value.summary === "string" &&
  isNamedReference(value.category) &&
  isNamedReference(value.relatedSystem) &&
  isRequestedPriority(value.requestedPriority) &&
  isCurrentStatus(value.currentStatus) &&
  typeof value.updatedAt === "string";

const isTicketListResponse = (value: unknown): value is TicketListResponse =>
  isRecord(value) &&
  isUnknownArray(value.items) &&
  value.items.every(isTicketSummary) &&
  isPositiveSafeInteger(value.page) &&
  isPageSize(value.pageSize) &&
  isNonNegativeSafeInteger(value.totalItems) &&
  isNonNegativeSafeInteger(value.totalPages);

const requireItems = <T>(
  body: unknown,
  isItem: (value: unknown) => value is T,
  message = "The API returned an invalid reference-data response."
): T[] => {
  if (
    !isRecord(body) ||
    !isUnknownArray(body.items) ||
    !body.items.every(isItem)
  ) {
    throw invalidApiResponse(message);
  }

  return body.items;
};

export const getRelatedSystems = async (
  signal?: AbortSignal
): Promise<RelatedSystem[]> =>
  requireItems<RelatedSystem>(
    await unwrap(
      getApiRelatedSystems({
        client: apiClient,
        signal,
      })
    ),
    isNamedReference
  );

export const createTicket = async (
  input: CreateTicketInput,
  signal?: AbortSignal
): Promise<TicketDetail> => {
  const body = await unwrap(
    createApiTicket({
      body: {
        attachments: [...input.attachments],
        categoryId: input.categoryId,
        description: input.description,
        relatedSystemId: input.relatedSystemId,
        requestedPriority: input.requestedPriority,
        summary: input.summary,
      },
      client: apiClient,
      headers: csrfHeaders(),
      signal,
    })
  );

  return body.ticket;
};

export const getTickets = async (
  params: TicketListParams,
  signal?: AbortSignal
): Promise<TicketListResponse> => {
  const body = await unwrap(
    getApiTickets({
      client: apiClient,
      query: { ...params },
      signal,
    })
  );

  if (!isTicketListResponse(body)) {
    throw invalidApiResponse(
      "The API returned an invalid Ticket-list response."
    );
  }

  return body;
};

export const getTicket = async (
  ticketId: number,
  signal?: AbortSignal
): Promise<TicketDetail> =>
  await unwrap(
    getApiTicket({
      client: apiClient,
      path: { ticketId },
      signal,
    })
  );

export const uploadTicketAttachments = async (
  ticketId: number,
  attachments: readonly File[],
  signal?: AbortSignal
): Promise<AttachmentMetadata[]> => {
  const body = await unwrap(
    createApiTicketAttachments({
      body: { attachments: [...attachments] },
      client: apiClient,
      headers: csrfHeaders(),
      path: { ticketId },
      signal,
    })
  );

  if (
    !isRecord(body) ||
    !isUnknownArray(body.attachments) ||
    !body.attachments.every(isAttachmentMetadata)
  ) {
    throw invalidApiResponse(
      "The API returned an invalid Attachment response."
    );
  }

  return body.attachments;
};

export const downloadTicketAttachment = async (
  ticketId: number,
  attachmentId: number,
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string }> => {
  const { data: blob, response } = await unwrapWithResponse(
    getApiTicketAttachmentContent({
      client: apiClient,
      parseAs: "blob",
      path: { attachmentId, ticketId },
      signal,
    })
  );

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = /filename\*=UTF-8''(?<filename>[^;]+)/u.exec(
    disposition
  );
  const encodedFilename = filenameMatch?.groups?.filename;
  const filename =
    encodedFilename !== undefined && encodedFilename.length > 0
      ? decodeURIComponent(encodedFilename)
      : "attachment";

  return { blob, filename };
};

export const removeTicketAttachment = async (
  ticketId: number,
  attachmentId: number,
  reason: string,
  signal?: AbortSignal
): Promise<AttachmentMetadata> => {
  const body = await unwrap(
    removeApiTicketAttachment({
      body: { reason },
      client: apiClient,
      headers: csrfHeaders(),
      path: { attachmentId, ticketId },
      signal,
    })
  );

  if (!isRecord(body) || !isAttachmentMetadata(body.attachment)) {
    throw invalidApiResponse(
      "The API returned an invalid Attachment response."
    );
  }

  return body.attachment;
};
