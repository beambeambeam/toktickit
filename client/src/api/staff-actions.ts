import { apiClient } from "@/api/client";
import { invalidApiResponse, unwrap } from "@/api/errors";
import { isMyActionRow } from "@/api/staff-dashboard";
import { getApiStaffActions } from "@/generated/hey-api/sdk.gen";
import type { MyActionListResponse } from "@/generated/hey-api/types.gen";

export type StaffMyActionsPageSize = 10 | 20 | 50;

export interface StaffMyActionsParams {
  page: number;
  pageSize: StaffMyActionsPageSize;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[]
): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
};

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isPageSize = (value: unknown): value is StaffMyActionsPageSize =>
  value === 10 || value === 20 || value === 50;

const isMyActionListResponse = (
  value: unknown
): value is MyActionListResponse => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "items",
      "page",
      "pageSize",
      "totalItems",
      "totalPages",
    ])
  ) {
    return false;
  }

  return (
    Array.isArray(value.items) &&
    isPageSize(value.pageSize) &&
    value.items.length <= value.pageSize &&
    value.items.every(isMyActionRow) &&
    isPositiveSafeInteger(value.page) &&
    isNonNegativeSafeInteger(value.totalItems) &&
    isNonNegativeSafeInteger(value.totalPages)
  );
};

export const getStaffActions = async (
  params: StaffMyActionsParams,
  signal?: AbortSignal
): Promise<MyActionListResponse> => {
  const body = await unwrap(
    getApiStaffActions({
      client: apiClient,
      query: params,
      signal,
    })
  );

  if (!isMyActionListResponse(body)) {
    throw invalidApiResponse(
      "The API returned an invalid My Actions response."
    );
  }

  return body;
};
