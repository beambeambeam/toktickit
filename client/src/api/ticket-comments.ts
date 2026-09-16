import { getCsrfToken, apiClient } from "@/api/client";
import { ApiRequestError, invalidApiResponse, unwrap } from "@/api/errors";
import {
  createApiTicketComment,
  getApiTicketComments,
} from "@/generated/hey-api/sdk.gen";
import type { Entry } from "@/generated/hey-api/types.gen";

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

const isEntry = (value: unknown): value is Entry =>
  isRecord(value) &&
  typeof value.id === "number" &&
  Number.isSafeInteger(value.id) &&
  value.id > 0 &&
  typeof value.content === "string" &&
  isRecord(value.author) &&
  typeof value.author.id === "number" &&
  Number.isSafeInteger(value.author.id) &&
  value.author.id > 0 &&
  typeof value.author.displayName === "string" &&
  typeof value.createdAt === "string";

export const getTicketComments = async (
  ticketId: number,
  signal?: AbortSignal
): Promise<Entry[]> => {
  const body = await unwrap(
    getApiTicketComments({
      client: apiClient,
      path: { ticketId },
      signal,
    })
  );

  if (
    !isRecord(body) ||
    !Array.isArray(body.comments) ||
    !body.comments.every(isEntry)
  ) {
    throw invalidApiResponse(
      "The API returned an invalid public-comment response."
    );
  }

  return body.comments;
};

export const postTicketComment = async (
  ticketId: number,
  content: string,
  signal?: AbortSignal
): Promise<Entry> => {
  const body = await unwrap(
    createApiTicketComment({
      body: { content },
      client: apiClient,
      headers: csrfHeaders(),
      path: { ticketId },
      signal,
    })
  );

  if (!isRecord(body) || !isEntry(body.comment)) {
    throw invalidApiResponse(
      "The API returned an invalid public-comment response."
    );
  }

  return body.comment;
};
