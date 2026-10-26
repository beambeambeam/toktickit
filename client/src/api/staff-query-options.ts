import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import type { AuthUser } from "@/api/auth";
import { getStaffOwners, getStaffTickets } from "@/api/staff";
import type { StaffTicketListParams } from "@/api/staff";

export const staffTicketsQueryOptions = (
  principalId: number,
  principalRole: AuthUser["role"],
  params: StaffTicketListParams
) =>
  queryOptions({
    queryFn: async ({ signal }) => await getStaffTickets(params, signal),
    queryKey: ["staff-tickets", principalId, principalRole, params],
    retry: 1,
  });

export const staffOwnersQueryOptions = () =>
  queryOptions({
    queryFn: async ({ signal }) => await getStaffOwners(signal),
    queryKey: ["staff-owners"],
    retry: 1,
  });

// Ticket and Action writes change the Queue, Dashboard counts, and My Actions.
export const invalidateStaffWorkQueries = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["staff-tickets"] }),
    queryClient.invalidateQueries({ queryKey: ["staff-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["staff-my-actions"] }),
  ]);
};
