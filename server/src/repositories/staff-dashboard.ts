import type { Prisma } from "../generated/prisma/client.js";
import { actionSummaryInclude, myActionsWhere } from "./actions.js";
import { withDashboardSnapshot } from "./dashboard-snapshot.js";
import {
  activePrismaStatuses,
  ownerSelection,
  ticketPreviewSelection,
} from "./tickets.js";

const staffTicketPreviewSelection = {
  ...ticketPreviewSelection,
  itPriority: true,
  owner: { select: ownerSelection },
} as const;

export type StaffDashboardTicketRecord = Prisma.TicketGetPayload<{
  select: typeof staffTicketPreviewSelection;
}>;

export const findStaffDashboard = async (
  currentUserId: number,
  snapshotAt?: Date
) =>
  await withDashboardSnapshot(
    snapshotAt,
    async (database, { from, through }) => {
      const activeWhere = { currentStatus: { in: activePrismaStatuses } };
      const myActionWhere = myActionsWhere(currentUserId);
      const [
        activeUnassigned,
        activeOwned,
        statusCounts,
        priorityCounts,
        myActions,
        recentlyUpdatedTickets,
        urgentActiveTickets,
        myActionRows,
      ] = await Promise.all([
        database.ticket.count({
          where: { ...activeWhere, ownerId: null },
        }),
        database.ticket.count({
          where: { ...activeWhere, ownerId: currentUserId },
        }),
        database.ticket.groupBy({
          _count: { _all: true },
          by: ["currentStatus"],
        }),
        database.ticket.groupBy({
          _count: { _all: true },
          by: ["itPriority"],
          where: activeWhere,
        }),
        database.actionTaken.count({ where: myActionWhere }),
        database.ticket.findMany({
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: staffTicketPreviewSelection,
          take: 5,
          where: { updatedAt: { gte: from, lte: through } },
        }),
        database.ticket.findMany({
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: staffTicketPreviewSelection,
          take: 5,
          where: { ...activeWhere, itPriority: "Urgent" },
        }),
        database.actionTaken.findMany({
          include: actionSummaryInclude,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 5,
          where: myActionWhere,
        }),
      ]);

      return {
        counts: {
          activeByPriority: priorityCounts,
          activeOwned,
          activeUnassigned,
          byStatus: statusCounts,
          myActions,
        },
        previews: {
          myActions: myActionRows,
          recentlyUpdatedTickets,
          urgentActiveTickets,
        },
      };
    }
  );
