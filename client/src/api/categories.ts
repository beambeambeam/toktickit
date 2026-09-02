import { queryOptions } from "@tanstack/react-query";

import { ApiConnectionError, apiClient } from "@/api/client";
import { getApiCategoriesOptions } from "@/generated/hey-api/@tanstack/react-query.gen";
import type { getApiCategoriesQueryKey } from "@/generated/hey-api/@tanstack/react-query.gen";
import type {
  Category,
  CategoryListResponse,
} from "@/generated/hey-api/types.gen";

export type { Category } from "@/generated/hey-api/types.gen";

const generatedCategoryOptions = getApiCategoriesOptions({ client: apiClient });
type CategoryQueryContext = Parameters<
  NonNullable<typeof generatedCategoryOptions.queryFn>
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

const normalizeCategoryError = (error: unknown): Error => {
  if (error instanceof ApiConnectionError) {
    return error;
  }

  const apiErrorMessage = getApiErrorMessage(error);
  if (apiErrorMessage !== undefined) {
    return new Error(apiErrorMessage, { cause: error });
  }

  return new Error("Unable to load supported request categories.", {
    cause: error,
  });
};

const getCategoryItems = (
  response: CategoryListResponse | Category[]
): Category[] => {
  if (Array.isArray(response)) {
    return response;
  }

  return response.items;
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
        return getCategoryItems(await queryFn(context));
      } catch (error: unknown) {
        throw normalizeCategoryError(error);
      }
    },
    queryKey: generatedCategoryOptions.queryKey,
    retry: 1,
  });
