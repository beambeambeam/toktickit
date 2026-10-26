import { ApiError } from "../errors/api-error.js";
import { findRequesterDashboard } from "../repositories/requester-dashboard.js";
import type { RequesterDashboardResponse } from "../types/requester-dashboard.js";
import { prismaStatusToCurrent } from "../types/ticket-workflow.js";

export const getRequesterDashboard = async (
  requesterId: number
): Promise<RequesterDashboardResponse> => {
  try {
    const dashboard = await findRequesterDashboard(requesterId);

    return {
      counts: dashboard.counts,
      generatedAt: dashboard.generatedAt.toISOString(),
      previews: {
        recentlyResolved: dashboard.previews.recentlyResolved.map((ticket) => ({
          currentStatus: prismaStatusToCurrent[ticket.currentStatus],
          id: ticket.id,
          requestedPriority: ticket.requestedPriority,
          resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
          summary: ticket.summary,
          ticketNumber: ticket.ticketNumber,
          updatedAt: ticket.updatedAt.toISOString(),
        })),
        recentlyUpdated: dashboard.previews.recentlyUpdated.map((ticket) => ({
          currentStatus: prismaStatusToCurrent[ticket.currentStatus],
          id: ticket.id,
          requestedPriority: ticket.requestedPriority,
          resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
          summary: ticket.summary,
          ticketNumber: ticket.ticketNumber,
          updatedAt: ticket.updatedAt.toISOString(),
        })),
      },
      window: {
        from: dashboard.window.from.toISOString(),
        through: dashboard.window.through.toISOString(),
      },
    };
  } catch {
    throw new ApiError(
      500,
      "REQUESTER_DASHBOARD_FAILURE",
      "Unable to load the Requester dashboard."
    );
  }
};
