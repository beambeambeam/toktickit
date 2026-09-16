import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type { CurrentStatus as PrismaCurrentStatus } from "../generated/prisma/enums.js";
import type { UserRoleValue } from "../types/users.js";

const internalNoteSelect = {
  author: {
    select: {
      displayName: true,
      id: true,
    },
  },
  content: true,
  createdAt: true,
  id: true,
} satisfies Prisma.InternalNoteSelect;

const internalNoteOrder: Prisma.InternalNoteOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];

export type InternalNoteRecord = Prisma.InternalNoteGetPayload<{
  select: typeof internalNoteSelect;
}>;

export interface InternalNoteTicketRecord {
  currentStatus: PrismaCurrentStatus;
  id: number;
}

export const findInternalNoteTicket = async (
  ticketId: number
): Promise<InternalNoteTicketRecord | null> =>
  await prisma.ticket.findUnique({
    select: { currentStatus: true, id: true },
    where: { id: ticketId },
  });

export const findInternalNotesForReader = async (
  ticketId: number
): Promise<InternalNoteRecord[] | null> => {
  const ticket = await findInternalNoteTicket(ticketId);

  if (ticket === null) {
    return null;
  }

  return await prisma.internalNote.findMany({
    orderBy: internalNoteOrder,
    select: internalNoteSelect,
    where: { ticketId },
  });
};

type InternalNoteCreateOutcome =
  | { kind: "created"; note: InternalNoteRecord }
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
    select: { currentStatus: true, id: true },
    where: { id: ticketId },
  });
};

export const createInternalNote = async (
  currentUserId: number,
  role: UserRoleValue,
  ticketId: number,
  content: string
): Promise<InternalNoteCreateOutcome> =>
  await prisma.$transaction(async (database) => {
    const actor = await lockUser(database, currentUserId);

    if (
      actor === null ||
      !actor.isActive ||
      actor.role !== role ||
      role !== "ITStaff"
    ) {
      return { kind: "forbidden" };
    }

    const ticket = await lockTicket(database, ticketId);

    if (ticket === null) {
      return { kind: "not-found" };
    }

    if (
      ticket.currentStatus === "Closed" ||
      ticket.currentStatus === "Cancelled"
    ) {
      return { kind: "terminal" };
    }

    const note = await database.internalNote.create({
      data: {
        authorId: currentUserId,
        content,
        createdAt: new Date(),
        ticketId,
      },
      select: internalNoteSelect,
    });

    return { kind: "created", note };
  });
