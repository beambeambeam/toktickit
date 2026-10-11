import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type { CurrentStatus as PrismaCurrentStatus } from "../generated/prisma/enums.js";
import { getSevenDayWindow } from "../types/dashboard.js";
import {
  activeTicketStatuses,
  currentStatusToPrisma,
} from "../types/ticket-workflow.js";

const ticketPreviewSelection = {
  currentStatus: true,
  id: true,
  requestedPriority: true,
  resolvedAt: true,
  summary: true,
  ticketNumber: true,
  updatedAt: true,
} as const;

const activePrismaStatuses = activeTicketStatuses.map(
  (status): PrismaCurrentStatus => currentStatusToPrisma[status]
);
const recentlyResolvedStatuses: PrismaCurrentStatus[] = ["Resolved", "Closed"];

export const findRequesterDashboard = async (requesterId: number) =>
  await prisma.$transaction(
    async (database) => {
      const [snapshot] = await database.$queryRaw<{ generatedAt: Date }[]>(
        Prisma.sql`SELECT transaction_timestamp() AS "generatedAt"`
      );
      if (snapshot === undefined) {
        throw new Error("The dashboard snapshot time is unavailable.");
      }

      const { from, through } = getSevenDayWindow(snapshot.generatedAt);
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
        generatedAt: snapshot.generatedAt,
        previews: {
          recentlyResolved: recentlyResolvedPreviews,
          recentlyUpdated: recentlyUpdatedPreviews,
        },
        window: { from, through },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
  );
