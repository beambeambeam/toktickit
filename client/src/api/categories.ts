import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import { getApiCategoriesOptions } from "@/generated/hey-api/@tanstack/react-query.gen";
import type { getApiCategoriesQueryKey } from "@/generated/hey-api/@tanstack/react-query.gen";
import type { Category } from "@/generated/hey-api/types.gen";

export type { Category } from "@/generated/hey-api/types.gen";

const generatedCategoryOptions = getApiCategoriesOptions({ client: apiClient });
type CategoryQueryContext = Parameters<
  NonNullable<typeof generatedCategoryOptions.queryFn>
>[0];

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

      return await queryFn(context);
    },
    queryKey: generatedCategoryOptions.queryKey,
    retry: 1,
  });
