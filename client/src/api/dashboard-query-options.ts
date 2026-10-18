import { queryOptions } from "@tanstack/react-query";

import type { AuthUser } from "@/api/auth";
import { ApiRequestError } from "@/api/errors";
import { getRequesterDashboard } from "@/api/requester-dashboard";
import { getStaffDashboard } from "@/api/staff-dashboard";

type PrincipalRole = AuthUser["role"];

export const dashboardRetry = (failureCount: number, error: Error): boolean =>
  !(
    error instanceof ApiRequestError &&
    (error.status === 401 || error.status === 403)
  ) && failureCount < 1;

export const requesterDashboardQueryOptions = (
  principalId: number,
  principalRole: PrincipalRole
) =>
  queryOptions({
    queryFn: async ({ signal }) => await getRequesterDashboard(signal),
    queryKey: ["requester-dashboard", principalId, principalRole],
    // Ticket writes elsewhere change the counts, so refetch on every visit.
    refetchOnMount: "always",
    retry: dashboardRetry,
  });

export const staffDashboardQueryOptions = (
  principalId: number,
  principalRole: PrincipalRole
) =>
  queryOptions({
    queryFn: async ({ signal }) => await getStaffDashboard(signal),
    queryKey: ["staff-dashboard", principalId, principalRole],
    // Ticket and Action writes elsewhere change the counts, so refetch on every visit.
    refetchOnMount: "always",
    retry: dashboardRetry,
  });
