import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import { getApiHealthOptions } from "@/generated/hey-api/@tanstack/react-query.gen";
import type { getApiHealthQueryKey } from "@/generated/hey-api/@tanstack/react-query.gen";
import type { ApiError, HealthResponse } from "@/generated/hey-api/types.gen";

export type { ApiError, HealthResponse } from "@/generated/hey-api/types.gen";

export type HealthQueryError = Error;

const generatedHealthOptions = getApiHealthOptions({ client: apiClient });
type HealthQueryContext = Parameters<
  NonNullable<typeof generatedHealthOptions.queryFn>
>[0];

const isApiError = (error: unknown): error is ApiError =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string";

const normalizeHealthError = (error: unknown): HealthQueryError => {
  if (error instanceof Error) {
    return error;
  }

  if (isApiError(error)) {
    return new Error(error.message, { cause: error });
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
