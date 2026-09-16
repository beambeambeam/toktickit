import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type { CurrentStatus as PrismaCurrentStatus } from "../generated/prisma/enums.js";
import type { UserRoleValue } from "../types/users.js";

const publicCommentSelect = {
  author: {
    select: {
      displayName: true,
      id: true,
    },
  },
  content: true,
  createdAt: true,
  id: true,
} satisfies Prisma.PublicCommentSelect;

const publicCommentOrder: Prisma.PublicCommentOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];

export type PublicCommentRecord = Prisma.PublicCommentGetPayload<{
  select: typeof publicCommentSelect;
}>;

export interface PublicCommentTicketRecord {
  currentStatus: PrismaCurrentStatus;
  id: number;
  requesterId: number;
}

const canReadTicket = (
  role: UserRoleValue,
  userId: number,
  requesterId: number
) => role !== "Requester" || userId === requesterId;

export const findTicketForPublicComments = async (
  userId: number,
  role: UserRoleValue,
  ticketId: number
): Promise<PublicCommentTicketRecord | null> =>
  await prisma.ticket.findFirst({
    select: {
      currentStatus: true,
      id: true,
      requesterId: true,
    },
    where:
      role === "Requester"
        ? { id: ticketId, requesterId: userId }
        : { id: ticketId },
  });

export const findPublicCommentsForReader = async (
  userId: number,
  role: UserRoleValue,
  ticketId: number
): Promise<PublicCommentRecord[] | null> => {
  const ticket = await findTicketForPublicComments(userId, role, ticketId);

  if (ticket === null || !canReadTicket(role, userId, ticket.requesterId)) {
    return null;
  }

  return await prisma.publicComment.findMany({
    orderBy: publicCommentOrder,
    select: publicCommentSelect,
    where: { ticketId },
  });
};

type PublicCommentCreateOutcome =
  | { kind: "created"; comment: PublicCommentRecord }
  | { kind: "forbidden" }
  | { kind: "not-found" }
  | { kind: "terminal" };

const lockUser = async (database: Prisma.TransactionClient, userId: number) => {
  await database.$queryRaw(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
  );

  return await database.user.findUnique({
    select: { id: true, isActive: true, role: true },
    where: { id: userId },
  });
};

const lockTicket = async (
  database: Prisma.TransactionClient,
  ticketId: number
) => {
  await database.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`
  );

  return await database.ticket.findUnique({
    select: { currentStatus: true, id: true, requesterId: true },
    where: { id: ticketId },
  });
};

export const createPublicComment = async (
  currentUserId: number,
  role: UserRoleValue,
  ticketId: number,
  content: string
): Promise<PublicCommentCreateOutcome> =>
  await prisma.$transaction(async (database) => {
    const actor = await lockUser(database, currentUserId);

    if (
      actor === null ||
      !actor.isActive ||
      actor.role !== role ||
      (role !== "Requester" && role !== "ITStaff")
    ) {
      return { kind: "forbidden" };
    }

    const ticket = await lockTicket(database, ticketId);

    if (ticket === null) {
      return { kind: "not-found" };
    }

    if (role === "Requester" && ticket.requesterId !== currentUserId) {
      return { kind: "not-found" };
    }

    if (
      ticket.currentStatus === "Closed" ||
      ticket.currentStatus === "Cancelled"
    ) {
      return { kind: "terminal" };
    }

    const now = new Date();
    const comment = await database.publicComment.create({
      data: {
        authorId: currentUserId,
        content,
        createdAt: now,
        ticketId,
      },
      select: publicCommentSelect,
    });

    await database.ticket.update({
      data: {
        updatedAt: now,
        version: { increment: 1 },
      },
      where: { id: ticketId },
    });

    return { comment, kind: "created" };
  });
