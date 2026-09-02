import { queryOptions } from "@tanstack/react-query";

import { categoriesQueryOptions } from "@/api/categories";
import {
  getDevelopmentRequesters,
  getRelatedSystems,
  getTicket,
  getTickets,
} from "@/api/requester";
import type { TicketListParams } from "@/api/requester";

export const developmentRequestersQueryOptions = () =>
  queryOptions({
    queryFn: async ({ signal }) => await getDevelopmentRequesters(signal),
    queryKey: ["development-requesters"],
    retry: 1,
  });

export const activeCategoriesQueryOptions = () =>
  categoriesQueryOptions({ enabled: true });

export const relatedSystemsQueryOptions = () =>
  queryOptions({
    queryFn: async ({ signal }) => await getRelatedSystems(signal),
    queryKey: ["related-systems"],
    retry: 1,
  });

export const ticketsQueryOptions = (
  requesterId: number,
  params: TicketListParams
) =>
  queryOptions({
    queryFn: async ({ signal }) =>
      await getTickets(requesterId, params, signal),
    queryKey: ["tickets", requesterId, params],
    retry: 1,
  });

export const ticketQueryOptions = (requesterId: number, ticketId: number) =>
  queryOptions({
    queryFn: async ({ signal }) =>
      await getTicket(requesterId, ticketId, signal),
    queryKey: ["ticket", requesterId, ticketId],
    retry: 1,
  });
