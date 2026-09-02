import { ApiConnectionError, apiClient } from "@/api/client";
import {
  createApiTicket,
  createApiTicketAttachments,
  getApiDevelopmentRequesters,
  getApiRelatedSystems,
  getApiTicket,
  getApiTicketAttachmentContent,
  getApiTickets,
  removeApiTicketAttachment,
} from "@/generated/hey-api/sdk.gen";
import type {
  AttachmentMetadata,
  DevelopmentRequester,
  RelatedSystem,
  TicketDetail,
  TicketListResponse,
} from "@/generated/hey-api/types.gen";

export const REQUESTER_HEADER = "X-Development-Requester-Id";

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
  requesterId: number;
  summary: string;
}

export class ApiRequestError extends Error {
  readonly code: string | undefined;
  readonly details: Record<string, unknown> | undefined;
  readonly status: number;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface GeneratedResult<T> {
  data?: T;
  error?: unknown;
  response?: Response;
}

const toApiRequestError = (error: unknown, status = 500): Error => {
  if (error instanceof ApiConnectionError || error instanceof ApiRequestError) {
    return error;
  }

  const errorBody =
    isRecord(error) && isRecord(error.error) ? error.error : undefined;
  const message =
    errorBody !== undefined && typeof errorBody.message === "string"
      ? errorBody.message
      : "The API request failed.";
  const code =
    errorBody !== undefined && typeof errorBody.code === "string"
      ? errorBody.code
      : undefined;
  const details =
    errorBody !== undefined && isRecord(errorBody.details)
      ? errorBody.details
      : undefined;

  return new ApiRequestError(status, message, code, details);
};

const unwrap = async <T>(result: Promise<GeneratedResult<T>>): Promise<T> => {
  try {
    const response = await result;

    if (response.error !== undefined || response.data === undefined) {
      throw toApiRequestError(response.error, response.response?.status);
    }

    return response.data;
  } catch (error: unknown) {
    throw toApiRequestError(error);
  }
};

const unwrapWithResponse = async <T>(
  result: Promise<GeneratedResult<T>>
): Promise<{ data: T; response: Response }> => {
  try {
    const response = await result;

    if (response.error !== undefined || response.data === undefined) {
      throw toApiRequestError(response.error, response.response?.status);
    }

    if (response.response === undefined) {
      throw new ApiRequestError(500, "The API returned no response metadata.");
    }

    return { data: response.data, response: response.response };
  } catch (error: unknown) {
    throw toApiRequestError(error);
  }
};

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

const isNamedReference = (
  value: unknown
): value is { id: number; name: string } =>
  isRecord(value) &&
  typeof value.id === "number" &&
  typeof value.name === "string";

const isDevelopmentRequester = (
  value: unknown
): value is DevelopmentRequester =>
  isRecord(value) &&
  typeof value.displayName === "string" &&
  typeof value.email === "string" &&
  typeof value.id === "number";

const requireItems = <T>(
  body: unknown,
  isItem: (value: unknown) => value is T
): T[] => {
  if (
    !isRecord(body) ||
    !isUnknownArray(body.items) ||
    !body.items.every(isItem)
  ) {
    throw new Error("The API returned an invalid reference-data response.");
  }

  return body.items;
};

export const getDevelopmentRequesters = async (
  signal?: AbortSignal
): Promise<DevelopmentRequester[]> =>
  requireItems<DevelopmentRequester>(
    await unwrap(
      getApiDevelopmentRequesters({
        client: apiClient,
        signal,
      })
    ),
    isDevelopmentRequester
  );

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

const requesterHeaders = (
  requesterId: number
): { "X-Development-Requester-Id": number } => ({
  [REQUESTER_HEADER]: requesterId,
});

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
      headers: requesterHeaders(input.requesterId),
      signal,
    })
  );

  return body.ticket;
};

export const getTickets = async (
  requesterId: number,
  params: TicketListParams,
  signal?: AbortSignal
): Promise<TicketListResponse> =>
  await unwrap(
    getApiTickets({
      client: apiClient,
      headers: requesterHeaders(requesterId),
      query: params,
      signal,
    })
  );

export const getTicket = async (
  requesterId: number,
  ticketId: number,
  signal?: AbortSignal
): Promise<TicketDetail> =>
  await unwrap(
    getApiTicket({
      client: apiClient,
      headers: requesterHeaders(requesterId),
      path: { ticketId },
      signal,
    })
  );

export const uploadTicketAttachments = async (
  requesterId: number,
  ticketId: number,
  attachments: readonly File[],
  signal?: AbortSignal
): Promise<AttachmentMetadata[]> => {
  const body = await unwrap(
    createApiTicketAttachments({
      body: { attachments: [...attachments] },
      client: apiClient,
      headers: requesterHeaders(requesterId),
      path: { ticketId },
      signal,
    })
  );

  return body.attachments;
};

export const downloadTicketAttachment = async (
  requesterId: number,
  ticketId: number,
  attachmentId: number,
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string }> => {
  const { data: blob, response } = await unwrapWithResponse(
    getApiTicketAttachmentContent({
      client: apiClient,
      headers: requesterHeaders(requesterId),
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
  requesterId: number,
  ticketId: number,
  attachmentId: number,
  reason: string,
  signal?: AbortSignal
): Promise<AttachmentMetadata> => {
  const body = await unwrap(
    removeApiTicketAttachment({
      body: { reason },
      client: apiClient,
      headers: requesterHeaders(requesterId),
      path: { attachmentId, ticketId },
      signal,
    })
  );

  return body.attachment;
};
