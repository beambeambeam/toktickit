import { queryOptions } from "@tanstack/react-query";

import { ApiConnectionError, apiClient } from "@/api/client";
import { getApiCategoriesOptions } from "@/generated/hey-api/@tanstack/react-query.gen";
import type { getApiCategoriesQueryKey } from "@/generated/hey-api/@tanstack/react-query.gen";
import type { ApiError, Category } from "@/generated/hey-api/types.gen";

export type { Category } from "@/generated/hey-api/types.gen";

const generatedCategoryOptions = getApiCategoriesOptions({ client: apiClient });
type CategoryQueryContext = Parameters<
  NonNullable<typeof generatedCategoryOptions.queryFn>
>[0];

const isApiError = (error: unknown): error is ApiError =>
  typeof error === "object" &&
  error !== null &&
  !(error instanceof Error) &&
  "message" in error &&
  typeof error.message === "string" &&
  error.message.trim().length > 0;

const normalizeCategoryError = (error: unknown): Error => {
  if (error instanceof ApiConnectionError) {
    return error;
  }

  if (isApiError(error)) {
    return new Error(error.message, { cause: error });
  }

  return new Error("Unable to load supported request categories.", {
    cause: error,
  });
};

export const categoriesQueryOptions = () =>
  queryOptions<
    Category[],
    Error,
    Category[],
    ReturnType<typeof getApiCategoriesQueryKey>
  >({
    enabled: false,
    queryFn: async (context: CategoryQueryContext) => {
      const { queryFn } = generatedCategoryOptions;

      if (!queryFn) {
        throw new Error("Category query function is unavailable");
      }

      try {
        return await queryFn(context);
      } catch (error: unknown) {
        throw normalizeCategoryError(error);
      }
    },
    queryKey: generatedCategoryOptions.queryKey,
    retry: 1,
  });
