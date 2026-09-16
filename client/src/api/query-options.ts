import { queryOptions } from "@tanstack/react-query";

import { categoriesQueryOptions } from "@/api/categories";
import { ApiRequestError } from "@/api/errors";
import { getRelatedSystems, getTicket, getTickets } from "@/api/requester";
import type { TicketListParams } from "@/api/requester";
import { getUser, getUsers } from "@/api/users";
import type { UserListParams } from "@/api/users";

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

export const ticketQueryOptions = (ticketId: number, principalId: number) =>
  queryOptions({
    queryFn: async ({ signal }) => await getTicket(ticketId, signal),
    queryKey: ["ticket", principalId, ticketId],
    retry: 1,
  });

export const usersQueryOptions = (params: UserListParams) =>
  queryOptions({
    queryFn: async ({ signal }) => await getUsers(params, signal),
    queryKey: ["users", params],
    retry: (failureCount, error) =>
      !(
        error instanceof ApiRequestError &&
        (error.status === 401 || error.status === 403)
      ) && failureCount < 1,
  });

export const userQueryOptions = (userId: number, principalId: number) =>
  queryOptions({
    queryFn: async ({ signal }) => await getUser(userId, signal),
    queryKey: ["user", principalId, userId],
    retry: 1,
  });
