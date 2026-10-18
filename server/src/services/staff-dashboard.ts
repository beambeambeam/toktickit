import { ApiError } from "../errors/api-error.js";
import type { CurrentStatus as PrismaCurrentStatus } from "../generated/prisma/enums.js";
import { findStaffDashboard } from "../repositories/staff-dashboard.js";
import type { StaffDashboardTicketRecord } from "../repositories/staff-dashboard.js";
import type {
  StaffDashboardResponse,
  StaffDashboardTicketPreview,
} from "../types/staff-dashboard.js";
import { prismaStatusToCurrent } from "../types/ticket-workflow.js";
import type { CurrentStatus, RequestedPriority } from "../types/tickets.js";
import { toMyActionRow } from "./action-presenters.js";
import { toOwner } from "./ticket-presenters.js";

interface StatusCountRow {
  _count: { _all: number };
  currentStatus: PrismaCurrentStatus;
}

interface PriorityCountRow {
  _count: { _all: number };
  itPriority: RequestedPriority;
}

const toStatusCounts = (
  rows: StatusCountRow[]
): Record<CurrentStatus, number> => {
  const counts: Record<CurrentStatus, number> = {
    Cancelled: 0,
    Closed: 0,
    "In Progress": 0,
    New: 0,
    Open: 0,
    Reopened: 0,
    Resolved: 0,
    "Waiting for Requester": 0,
  };

  for (const row of rows) {
    counts[prismaStatusToCurrent[row.currentStatus]] = row._count._all;
  }

  return counts;
};

const toPriorityCounts = (
  rows: PriorityCountRow[]
): Record<RequestedPriority, number> => {
  const counts: Record<RequestedPriority, number> = {
    High: 0,
    Low: 0,
    Medium: 0,
    Urgent: 0,
  };

  for (const row of rows) {
    counts[row.itPriority] = row._count._all;
  }

  return counts;
};

const toTicketPreview = (
  ticket: StaffDashboardTicketRecord
): StaffDashboardTicketPreview => ({
  currentStatus: prismaStatusToCurrent[ticket.currentStatus],
  id: ticket.id,
  itPriority: ticket.itPriority,
  owner: toOwner(ticket.owner),
  requestedPriority: ticket.requestedPriority,
  resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
  summary: ticket.summary,
  ticketNumber: ticket.ticketNumber,
  updatedAt: ticket.updatedAt.toISOString(),
});

export const getStaffDashboard = async (
  currentUserId: number
): Promise<StaffDashboardResponse> => {
  try {
    const dashboard = await findStaffDashboard(currentUserId);

    return {
      counts: {
        activeByPriority: toPriorityCounts(dashboard.counts.activeByPriority),
        activeOwned: dashboard.counts.activeOwned,
        activeUnassigned: dashboard.counts.activeUnassigned,
        byStatus: toStatusCounts(dashboard.counts.byStatus),
        myActions: dashboard.counts.myActions,
      },
      generatedAt: dashboard.generatedAt.toISOString(),
      previews: {
        myActions: dashboard.previews.myActions.map(toMyActionRow),
        recentlyUpdatedTickets:
          dashboard.previews.recentlyUpdatedTickets.map(toTicketPreview),
        urgentActiveTickets:
          dashboard.previews.urgentActiveTickets.map(toTicketPreview),
      },
      window: {
        from: dashboard.window.from.toISOString(),
        through: dashboard.window.through.toISOString(),
      },
    };
  } catch (error: unknown) {
    console.error("Unable to load the Staff dashboard.", error);
    throw new ApiError(
      500,
      "STAFF_DASHBOARD_FAILURE",
      "Unable to load the Staff dashboard."
    );
  }
};
