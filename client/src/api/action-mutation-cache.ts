import type { QueryClient } from "@tanstack/react-query";

import type { ActionMutationResult } from "@/api/actions";
import type { UserRole } from "@/generated/hey-api/types.gen";

export const refreshActionMutationQueries = async (
  queryClient: QueryClient,
  result: ActionMutationResult,
  principalId: number,
  principalRole: UserRole
) => {
  const ticketId = result.ticket.id;
  queryClient.setQueryData(["ticket", principalId, ticketId], result.ticket);
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["ticket", principalId, ticketId],
    }),
    queryClient.invalidateQueries({
      queryKey: ["ticket-actions", principalId, principalRole, ticketId],
    }),
    queryClient.invalidateQueries({
      queryKey: [
        "action-history",
        principalId,
        principalRole,
        ticketId,
        result.action.id,
      ],
    }),
    queryClient.invalidateQueries({ queryKey: ["tickets"] }),
    queryClient.invalidateQueries({ queryKey: ["staff-tickets"] }),
    queryClient.invalidateQueries({
      queryKey: ["dashboard", principalId, principalRole],
    }),
    queryClient.invalidateQueries({
      queryKey: ["staff-actions", principalId, principalRole],
    }),
  ]);
};
