import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import { getApiHealthOptions } from "@/generated/hey-api/@tanstack/react-query.gen";
import type { getApiHealthQueryKey } from "@/generated/hey-api/@tanstack/react-query.gen";
import type { HealthResponse } from "@/generated/hey-api/types.gen";

export type { ApiError, HealthResponse } from "@/generated/hey-api/types.gen";

export type HealthQueryError = Error;

const generatedHealthOptions = getApiHealthOptions({ client: apiClient });
type HealthQueryContext = Parameters<
  NonNullable<typeof generatedHealthOptions.queryFn>
>[0];

const getApiErrorMessage = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || error instanceof Error) {
    return undefined;
  }

  if (
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string" &&
    error.error.message.trim().length > 0
  ) {
    return error.error.message;
  }

  if (
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return undefined;
};

const normalizeHealthError = (error: unknown): HealthQueryError => {
  if (error instanceof Error) {
    return error;
  }

  const apiErrorMessage = getApiErrorMessage(error);
  if (apiErrorMessage !== undefined) {
    return new Error(apiErrorMessage, { cause: error });
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Health request failed", { cause: error });
};

export const healthQueryOptions = () =>
  queryOptions<
    HealthResponse,
    HealthQueryError,
    HealthResponse,
    ReturnType<typeof getApiHealthQueryKey>
  >({
    enabled: false,
    queryFn: async (context: HealthQueryContext) => {
      try {
        const { queryFn } = generatedHealthOptions;

        if (!queryFn) {
          throw new Error("Health query function is unavailable");
        }

        return await queryFn(context);
      } catch (error: unknown) {
        throw normalizeHealthError(error);
      }
    },
    queryKey: generatedHealthOptions.queryKey,
    retry: 1,
  });
