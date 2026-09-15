import { queryOptions } from "@tanstack/react-query";

import { getStaffOwners, getStaffTickets } from "@/api/staff";
import type { StaffTicketListParams } from "@/api/staff";

export {
  activeCategoriesQueryOptions,
  relatedSystemsQueryOptions,
  ticketQueryOptions,
} from "@/api/lab2-options";

export const staffTicketsQueryOptions = (params: StaffTicketListParams) =>
  queryOptions({
    queryFn: async ({ signal }) => await getStaffTickets(params, signal),
    queryKey: ["staff-tickets", params],
    retry: 1,
  });

export const staffOwnersQueryOptions = () =>
  queryOptions({
    queryFn: async ({ signal }) => await getStaffOwners(signal),
    queryKey: ["staff-owners"],
    retry: 1,
  });
