import { queryOptions } from "@tanstack/react-query";

import type { AuthUser } from "@/api/auth";
import { ApiRequestError } from "@/api/errors";
import { getRequesterDashboard } from "@/api/requester-dashboard";

type PrincipalRole = AuthUser["role"];

export const requesterDashboardQueryOptions = (
  principalId: number,
  principalRole: PrincipalRole
) =>
  queryOptions({
    queryFn: async ({ signal }) => await getRequesterDashboard(signal),
    queryKey: ["requester-dashboard", principalId, principalRole],
    retry: (failureCount, error) =>
      !(
        error instanceof ApiRequestError &&
        (error.status === 401 || error.status === 403)
      ) && failureCount < 1,
  });
