import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import type { AuthUser } from "@/api/auth";
import { dashboardRetry } from "@/api/dashboard-query-options";
import { getStaffActions } from "@/api/staff-actions";
import type { StaffMyActionsParams } from "@/api/staff-actions";

export const staffMyActionsQueryOptions = (
  principalId: number,
  principalRole: AuthUser["role"],
  params: StaffMyActionsParams
) =>
  queryOptions({
    // Keep the current page mounted while the next one loads so pagination keeps focus.
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => await getStaffActions(params, signal),
    queryKey: [
      "staff-my-actions",
      principalId,
      principalRole,
      params.page,
      params.pageSize,
    ],
    // Action and Ticket writes elsewhere change the list, so refetch on every visit.
    refetchOnMount: "always",
    retry: dashboardRetry,
  });
