import type { CurrentStatus as PrismaCurrentStatus } from "../generated/prisma/enums.js";
import { withDashboardSnapshot } from "./dashboard-snapshot.js";
import { activePrismaStatuses } from "./tickets.js";

const ticketPreviewSelection = {
  currentStatus: true,
  id: true,
  requestedPriority: true,
  resolvedAt: true,
  summary: true,
  ticketNumber: true,
  updatedAt: true,
} as const;

const recentlyResolvedStatuses: PrismaCurrentStatus[] = ["Resolved", "Closed"];

export const findRequesterDashboard = async (
  requesterId: number,
  snapshotAt?: Date
) =>
  await withDashboardSnapshot(
    snapshotAt,
    async (database, { from, through }) => {
      const requester = { requesterId };
      const recentlyUpdatedWhere = {
        ...requester,
        updatedAt: { gte: from, lte: through },
      };
      const recentlyResolvedWhere = {
        ...requester,
        currentStatus: { in: recentlyResolvedStatuses },
        resolvedAt: { gte: from, lte: through },
      };
      const [
        activeTickets,
        waitingForRequester,
        recentlyUpdated,
        recentlyResolved,
        recentlyUpdatedPreviews,
        recentlyResolvedPreviews,
      ] = await Promise.all([
        database.ticket.count({
          where: { ...requester, currentStatus: { in: activePrismaStatuses } },
        }),
        database.ticket.count({
          where: { ...requester, currentStatus: "WaitingForRequester" },
        }),
        database.ticket.count({ where: recentlyUpdatedWhere }),
        database.ticket.count({ where: recentlyResolvedWhere }),
        database.ticket.findMany({
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: ticketPreviewSelection,
          take: 5,
          where: recentlyUpdatedWhere,
        }),
        database.ticket.findMany({
          orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
          select: ticketPreviewSelection,
          take: 5,
          where: recentlyResolvedWhere,
        }),
      ]);

      return {
        counts: {
          activeTickets,
          recentlyResolved,
          recentlyUpdated,
          waitingForRequester,
        },
        previews: {
          recentlyResolved: recentlyResolvedPreviews,
          recentlyUpdated: recentlyUpdatedPreviews,
        },
      };
    }
  );
