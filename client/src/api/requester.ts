import { ApiConnectionError } from "@/api/client";
import { env } from "@/env";
import type {
  AttachmentListResponse,
  AttachmentMetadata,
  Category,
  CategoryListResponse,
  CreateTicketResponse,
  DevelopmentRequester,
  DevelopmentRequesterListResponse,
  RelatedSystem,
  RelatedSystemListResponse,
  RemoveAttachmentResponse,
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

const getApiUrl = (path: string): string =>
  new URL(path, env.VITE_API_URL).toString();

const readResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;
  const headers = new Headers(init.headers);
  const acceptHeader = headers.get("Accept");
  headers.set(
    "Accept",
    acceptHeader !== null && acceptHeader.length > 0
      ? acceptHeader
      : "application/json"
  );

  try {
    response = await globalThis.fetch(getApiUrl(path), {
      ...init,
      headers,
    });
  } catch (error: unknown) {
    if (error instanceof ApiConnectionError) {
      throw error;
    }

    throw new ApiConnectionError(error);
  }

  const body = await readResponseBody(response);

  if (!response.ok) {
    const errorBody =
      isRecord(body) && isRecord(body.error) ? body.error : undefined;
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

    throw new ApiRequestError(response.status, message, code, details);
  }

  // The endpoint response type is selected by each caller's generated contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return body as T;
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
    await request<DevelopmentRequesterListResponse>(
      "/api/development-requesters",
      { signal }
    ),
    isDevelopmentRequester
  );

export const getCategories = async (
  signal?: AbortSignal
): Promise<Category[]> =>
  requireItems<Category>(
    await request<CategoryListResponse>("/api/categories", { signal }),
    isNamedReference
  );

export const getRelatedSystems = async (
  signal?: AbortSignal
): Promise<RelatedSystem[]> =>
  requireItems<RelatedSystem>(
    await request<RelatedSystemListResponse>("/api/related-systems", {
      signal,
    }),
    isNamedReference
  );

const requesterHeaders = (requesterId: number): Headers =>
  new Headers([[REQUESTER_HEADER, requesterId.toString()]]);

export const createTicket = async (
  input: CreateTicketInput,
  signal?: AbortSignal
): Promise<TicketDetail> => {
  const formData = new FormData();
  formData.set("categoryId", input.categoryId.toString());
  formData.set("relatedSystemId", input.relatedSystemId.toString());
  formData.set("summary", input.summary);
  formData.set("description", input.description);
  formData.set("requestedPriority", input.requestedPriority);

  for (const attachment of input.attachments) {
    formData.append("attachments", attachment);
  }

  const body = await request<CreateTicketResponse>("/api/tickets", {
    body: formData,
    headers: requesterHeaders(input.requesterId),
    method: "POST",
    signal,
  });

  return body.ticket;
};

export const getTickets = async (
  requesterId: number,
  params: TicketListParams,
  signal?: AbortSignal
): Promise<TicketListResponse> => {
  const query = new URLSearchParams();

  const addQueryParameter = (
    key: string,
    value: number | string | undefined
  ) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  };

  addQueryParameter("categoryId", params.categoryId);
  addQueryParameter("currentStatus", params.currentStatus);
  addQueryParameter("page", params.page);
  addQueryParameter("pageSize", params.pageSize);
  addQueryParameter("relatedSystemId", params.relatedSystemId);
  addQueryParameter("requestedPriority", params.requestedPriority);
  addQueryParameter("search", params.search);
  addQueryParameter("sortBy", params.sortBy);
  addQueryParameter("sortDirection", params.sortDirection);

  const queryString = query.toString();
  return await request<TicketListResponse>(
    `/api/tickets${queryString.length > 0 ? `?${queryString}` : ""}`,
    {
      headers: requesterHeaders(requesterId),
      signal,
    }
  );
};

export const getTicket = async (
  requesterId: number,
  ticketId: number,
  signal?: AbortSignal
): Promise<TicketDetail> =>
  await request<TicketDetail>(`/api/tickets/${ticketId}`, {
    headers: requesterHeaders(requesterId),
    signal,
  });

export const uploadTicketAttachments = async (
  requesterId: number,
  ticketId: number,
  attachments: readonly File[],
  signal?: AbortSignal
): Promise<AttachmentMetadata[]> => {
  const formData = new FormData();

  for (const attachment of attachments) {
    formData.append("attachments", attachment);
  }

  const body = await request<AttachmentListResponse>(
    `/api/tickets/${ticketId}/attachments`,
    {
      body: formData,
      headers: requesterHeaders(requesterId),
      method: "POST",
      signal,
    }
  );

  return body.attachments;
};

export const downloadTicketAttachment = async (
  requesterId: number,
  ticketId: number,
  attachmentId: number,
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string }> => {
  let response: Response;

  try {
    response = await globalThis.fetch(
      getApiUrl(`/api/tickets/${ticketId}/attachments/${attachmentId}/content`),
      {
        headers: requesterHeaders(requesterId),
        signal,
      }
    );
  } catch (error: unknown) {
    throw new ApiConnectionError(error);
  }

  if (!response.ok) {
    const body = await readResponseBody(response);
    const errorBody =
      isRecord(body) && isRecord(body.error) ? body.error : undefined;
    throw new ApiRequestError(
      response.status,
      errorBody !== undefined && typeof errorBody.message === "string"
        ? errorBody.message
        : "The Attachment could not be downloaded.",
      errorBody !== undefined && typeof errorBody.code === "string"
        ? errorBody.code
        : undefined
    );
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = /filename\*=UTF-8''(?<filename>[^;]+)/u.exec(
    disposition
  );
  const encodedFilename = filenameMatch?.groups?.filename;
  const filename =
    encodedFilename !== undefined && encodedFilename.length > 0
      ? decodeURIComponent(encodedFilename)
      : "attachment";

  return { blob: await response.blob(), filename };
};

export const removeTicketAttachment = async (
  requesterId: number,
  ticketId: number,
  attachmentId: number,
  reason: string,
  signal?: AbortSignal
): Promise<AttachmentMetadata> => {
  const headers = requesterHeaders(requesterId);
  headers.set("Content-Type", "application/json");
  const body = await request<RemoveAttachmentResponse>(
    `/api/tickets/${ticketId}/attachments/${attachmentId}`,
    {
      body: JSON.stringify({ reason }),
      headers,
      method: "DELETE",
      signal,
    }
  );

  return body.attachment;
};
