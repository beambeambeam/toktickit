import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type {
  CurrentStatus as PrismaCurrentStatus,
  UserRole as PrismaUserRole,
} from "../generated/prisma/enums.js";
import {
  isAllowedStatusTransition,
  isEligibleTicketOwner,
  prismaStatusToCurrent,
  statusRequiresEligibleOwner,
  terminalStatuses,
} from "../types/ticket-workflow.js";
import { ticketDetailInclude } from "./tickets.js";

type TicketDatabase = Prisma.TransactionClient;

type TicketDetailDatabaseRecord = Prisma.TicketGetPayload<{
  include: typeof ticketDetailInclude;
}>;

type StatusMutationOutcome =
  | { kind: "actor-ineligible" }
  | { kind: "confirmation-required" }
  | { kind: "invalid-transition" }
  | { kind: "not-found" }
  | { kind: "owner-required" }
  | { kind: "success"; ticket: TicketDetailDatabaseRecord }
  | { kind: "version-conflict" };

interface ResolutionIndication {
  author: { displayName: string; id: number };
  createdAt: Date;
}

type ResolutionIndicationOutcome =
  | { kind: "actor-ineligible" }
  | { kind: "not-found" }
  | { indication: ResolutionIndication; kind: "success" | "unchanged" }
  | { kind: "terminal" };

const lockUser = async (database: TicketDatabase, userId: number) => {
  await database.$queryRaw(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
  );
};

const lockTicket = async (database: TicketDatabase, ticketId: number) => {
  await database.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`
  );
};

const findLockedTicket = async (
  database: TicketDatabase,
  ticketId: number
): Promise<TicketDetailDatabaseRecord | null> =>
  await database.ticket.findUnique({
    include: ticketDetailInclude,
    where: { id: ticketId },
  });

const isEligibleOwner = (user: {
  isActive: boolean;
  role: PrismaUserRole;
}): boolean => isEligibleTicketOwner(user);

const toResolutionIndication = (
  ticket: TicketDetailDatabaseRecord
): ResolutionIndication | null =>
  ticket.resolutionIndicatedAt === null || ticket.resolutionIndicatedBy === null
    ? null
    : {
        author: {
          displayName: ticket.resolutionIndicatedBy.displayName,
          id: ticket.resolutionIndicatedBy.id,
        },
        createdAt: ticket.resolutionIndicatedAt,
      };

const getUserLockOrder = (
  currentUserId: number,
  ownerId: number | null
): number[] => {
  if (ownerId === null || ownerId === currentUserId) {
    return [currentUserId];
  }

  if (currentUserId < ownerId) {
    return [currentUserId, ownerId];
  }

  return [ownerId, currentUserId];
};

// oxlint-disable complexity -- the transaction enforces the complete status contract atomically.
export const updateTicketStatus = async (
  currentUserId: number,
  ticketId: number,
  nextStatus: PrismaCurrentStatus,
  version: number,
  confirmed: boolean | undefined
): Promise<StatusMutationOutcome> =>
  await prisma.$transaction(async (database) => {
    const ticketSnapshot = await database.ticket.findUnique({
      select: { ownerId: true },
      where: { id: ticketId },
    });
    const snapshotOwnerId = ticketSnapshot?.ownerId ?? null;
    const userIds = getUserLockOrder(currentUserId, snapshotOwnerId);

    for (const userId of userIds) {
      // oxlint-disable-next-line no-await-in-loop -- PostgreSQL row locks share one deterministic order.
      await lockUser(database, userId);
    }
    const currentUser = await database.user.findUnique({
      select: { isActive: true, role: true },
      where: { id: currentUserId },
    });

    if (
      currentUser === null ||
      !currentUser.isActive ||
      currentUser.role !== "ITStaff"
    ) {
      return { kind: "actor-ineligible" };
    }

    await lockTicket(database, ticketId);
    const ticket = await findLockedTicket(database, ticketId);

    if (ticket === null) {
      return { kind: "not-found" };
    }

    if (ticket.version !== version) {
      return { kind: "version-conflict" };
    }

    if (ticket.ownerId !== snapshotOwnerId) {
      return { kind: "version-conflict" };
    }

    const currentStatus = prismaStatusToCurrent[ticket.currentStatus];
    const nextStatusLabel = prismaStatusToCurrent[nextStatus];

    if (!isAllowedStatusTransition(currentStatus, nextStatusLabel)) {
      return { kind: "invalid-transition" };
    }

    if (
      (nextStatusLabel === "Resolved" ||
        nextStatusLabel === "Closed" ||
        nextStatusLabel === "Cancelled") &&
      confirmed !== true
    ) {
      return { kind: "confirmation-required" };
    }

    if (
      statusRequiresEligibleOwner(nextStatusLabel) &&
      (ticket.owner === null || !isEligibleOwner(ticket.owner))
    ) {
      return { kind: "owner-required" };
    }

    const now = new Date();
    const updated = await database.ticket.update({
      data: {
        currentStatus: nextStatus,
        statusChangedAt: now,
        updatedAt: now,
        version: ticket.version + 1,
        ...(nextStatusLabel === "Resolved" ? { resolvedAt: now } : {}),
        ...(nextStatusLabel === "Closed" ? { closedAt: now } : {}),
        ...(nextStatusLabel === "Cancelled" ? { cancelledAt: now } : {}),
        ...(nextStatusLabel === "Reopened"
          ? {
              reopenedAt: now,
              resolutionIndicatedAt: null,
              resolutionIndicatedByUserId: null,
              resolvedAt: null,
            }
          : {}),
      },
      include: ticketDetailInclude,
      where: { id: ticketId },
    });

    return { kind: "success", ticket: updated };
  });

// oxlint-enable complexity

export const indicateTicketResolution = async (
  currentUserId: number,
  ticketId: number
): Promise<ResolutionIndicationOutcome> =>
  await prisma.$transaction(async (database) => {
    await lockUser(database, currentUserId);
    const currentUser = await database.user.findUnique({
      select: { isActive: true, role: true },
      where: { id: currentUserId },
    });

    if (
      currentUser === null ||
      !currentUser.isActive ||
      currentUser.role !== "Requester"
    ) {
      return { kind: "actor-ineligible" };
    }

    await lockTicket(database, ticketId);
    const ticket = await findLockedTicket(database, ticketId);

    if (ticket === null || ticket.requester.id !== currentUserId) {
      return { kind: "not-found" };
    }

    if (terminalStatuses.has(prismaStatusToCurrent[ticket.currentStatus])) {
      return { kind: "terminal" };
    }

    const existing = toResolutionIndication(ticket);
    if (existing !== null) {
      return { indication: existing, kind: "unchanged" };
    }

    const now = new Date();
    const updated = await database.ticket.update({
      data: {
        resolutionIndicatedAt: now,
        resolutionIndicatedByUserId: currentUserId,
        updatedAt: now,
        version: ticket.version + 1,
      },
      include: ticketDetailInclude,
      where: { id: ticketId },
    });
    const indication = toResolutionIndication(updated);

    if (indication === null) {
      throw new Error("Resolution indication was not persisted.");
    }

    return { indication, kind: "success" };
  });
