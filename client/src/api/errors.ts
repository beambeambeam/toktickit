import { ApiConnectionError } from "@/api/client";

export class ApiRequestError extends Error {
  readonly code: string | undefined;
  readonly details: Record<string, unknown> | undefined;
  readonly retryAfterSeconds: number | undefined;
  readonly status: number;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: Record<string, unknown>,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

export interface GeneratedResult<T> {
  data?: T;
  error?: unknown;
  response?: Response;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toApiRequestError = (
  error: unknown,
  status = 500,
  retryAfterSeconds?: number
): Error => {
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

  return new ApiRequestError(status, message, code, details, retryAfterSeconds);
};

const getRetryAfterSeconds = (
  response: Response | undefined
): number | undefined => {
  const value = response?.headers.get("Retry-After");
  if (value === null || value === undefined) {
    return undefined;
  }

  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined;
};

export const unwrap = async <T>(
  result: Promise<GeneratedResult<T>>
): Promise<T> => {
  try {
    const response = await result;

    if (response.error !== undefined || response.data === undefined) {
      throw toApiRequestError(
        response.error,
        response.response?.status,
        getRetryAfterSeconds(response.response)
      );
    }

    return response.data;
  } catch (error: unknown) {
    throw toApiRequestError(error);
  }
};

export const unwrapWithResponse = async <T>(
  result: Promise<GeneratedResult<T>>
): Promise<{ data: T; response: Response }> => {
  try {
    const response = await result;

    if (response.error !== undefined || response.data === undefined) {
      throw toApiRequestError(
        response.error,
        response.response?.status,
        getRetryAfterSeconds(response.response)
      );
    }

    if (response.response === undefined) {
      throw new ApiRequestError(500, "The API returned no response metadata.");
    }

    return { data: response.data, response: response.response };
  } catch (error: unknown) {
    throw toApiRequestError(error);
  }
};

export const invalidApiResponse = (message: string): ApiRequestError =>
  new ApiRequestError(500, message);
