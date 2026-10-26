import { queryOptions } from "@tanstack/react-query";

import { getTicketActions } from "@/api/actions";
import type { TicketActionsListParams } from "@/api/actions";
import type { UserRole } from "@/api/auth";

export const ticketActionsQueryOptions = (
  ticketId: number,
  principalId: number,
  principalRole: UserRole,
  params?: TicketActionsListParams
) => {
  const resolvedParams = params ?? { page: 1, pageSize: 20 };

  return queryOptions({
    queryFn: async ({ signal }) =>
      await getTicketActions(ticketId, resolvedParams, signal),
    queryKey: [
      "ticket-actions",
      principalId,
      principalRole,
      ticketId,
      resolvedParams.page,
      resolvedParams.pageSize,
    ],
    retry: 1,
  });
};
