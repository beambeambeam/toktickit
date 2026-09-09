import { queryOptions } from "@tanstack/react-query";

import { categoriesQueryOptions } from "@/api/categories";
import { getRelatedSystems, getTicket, getTickets } from "@/api/requester";
import type { TicketListParams } from "@/api/requester";

export const activeCategoriesQueryOptions = (
  options: { enabled?: boolean } = {}
) => categoriesQueryOptions({ enabled: options.enabled ?? true });

export const relatedSystemsQueryOptions = (
  options: { enabled?: boolean } = {}
) =>
  queryOptions({
    enabled: options.enabled ?? true,
    queryFn: async ({ signal }) => await getRelatedSystems(signal),
    queryKey: ["related-systems"],
    retry: 1,
  });

export const ticketsQueryOptions = (params: TicketListParams) =>
  queryOptions({
    queryFn: async ({ signal }) => await getTickets(params, signal),
    queryKey: ["tickets", params],
    retry: 1,
  });

export const ticketQueryOptions = (ticketId: number) =>
  queryOptions({
    queryFn: async ({ signal }) => await getTicket(ticketId, signal),
    queryKey: ["ticket", ticketId],
    retry: 1,
  });
