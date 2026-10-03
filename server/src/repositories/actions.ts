import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type { CurrentStatus as PrismaCurrentStatus } from "../generated/prisma/enums.js";
import {
  createActionSnapshot,
  getActionPayload,
  hashActionPayload,
} from "../models/action-payload.js";
import type { ActionListQuery, CreateActionInput } from "../types/actions.js";
import type { UserRoleValue } from "../types/users.js";
import { ticketDetailInclude } from "./tickets.js";

const actionUserSelection = {
  displayName: true,
  id: true,
  isActive: true,
  role: true,
} as const;

export const actionInclude = {
  assignee: { select: actionUserSelection },
  cancelledBy: { select: actionUserSelection },
  completedBy: { select: actionUserSelection },
  createdBy: { select: actionUserSelection },
  performedBy: { select: actionUserSelection },
} satisfies Prisma.ActionTakenInclude;

type ActionDatabase = Prisma.TransactionClient;

type ActionDatabaseRecord = Prisma.ActionTakenGetPayload<{
  include: typeof actionInclude;
}>;

type TicketDetailDatabaseRecord = Prisma.TicketGetPayload<{
  include: typeof ticketDetailInclude;
}>;

export type CreateActionOutcome =
  | { kind: "actor-ineligible" }
  | { kind: "assignee-ineligible" }
  | { kind: "not-found" }
  | { kind: "request-id-conflict" }
  | { kind: "terminal" }
  | { kind: "version-conflict" }
  | {
      action: ActionDatabaseRecord;
      kind: "created" | "replayed";
      ticket: TicketDetailDatabaseRecord;
    };

const actionClosedStatuses = new Set<PrismaCurrentStatus>([
  "Resolved",
  "Closed",
  "Cancelled",
]);

const isEligibleActionUser = (
  user: {
    isActive: boolean;
    role: UserRoleValue;
  } | null
): boolean =>
  user !== null &&
  user.isActive &&
  (user.role === "ITStaff" || user.role === "Administrator");

const lockUser = async (database: ActionDatabase, userId: number) => {
  await database.$queryRaw(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
  );
};

const lockUsers = async (
  database: ActionDatabase,
  userIds: readonly number[]
) => {
  const sortedIds = [...new Set(userIds)];
  // oxlint-disable-next-line unicorn/no-array-sort -- copy is local to this transaction.
  sortedIds.sort((left, right) => left - right);

  for (const userId of sortedIds) {
    // Account lifecycle writes use the same ascending User lock order.
    // oxlint-disable-next-line no-await-in-loop
    await lockUser(database, userId);
  }
};

const lockTicket = async (database: ActionDatabase, ticketId: number) => {
  await database.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`
  );
};

const findLockedTicket = async (
  database: ActionDatabase,
  ticketId: number
): Promise<TicketDetailDatabaseRecord | null> =>
  await database.ticket.findUnique({
    include: ticketDetailInclude,
    where: { id: ticketId },
  });

const findActionByRequestId = async (
  database: ActionDatabase,
  ticketId: number,
  actorId: number,
  requestId: string
): Promise<ActionDatabaseRecord | null> =>
  await database.actionTaken.findUnique({
    include: actionInclude,
    where: {
      ticketId_createdByUserId_requestId: {
        createdByUserId: actorId,
        requestId,
        ticketId,
      },
    },
  });

export const createAction = async (
  actorId: number,
  ticketId: number,
  input: CreateActionInput
): Promise<CreateActionOutcome> =>
  await prisma.$transaction(async (database) => {
    const assigneeId = input.assigneeId ?? actorId;
    await lockUsers(database, [actorId, assigneeId]);

    const actor = await database.user.findUnique({
      select: { id: true, isActive: true, role: true },
      where: { id: actorId },
    });

    if (!isEligibleActionUser(actor)) {
      return { kind: "actor-ineligible" };
    }

    await lockTicket(database, ticketId);
    const ticket = await findLockedTicket(database, ticketId);

    if (ticket === null) {
      return { kind: "not-found" };
    }

    const payload = getActionPayload(input, assigneeId);
    const hash = hashActionPayload(payload);
    const existing = await findActionByRequestId(
      database,
      ticketId,
      actorId,
      input.requestId
    );

    if (existing !== null) {
      if (existing.payloadHash !== hash) {
        return { kind: "request-id-conflict" };
      }

      return { action: existing, kind: "replayed", ticket };
    }

    if (actionClosedStatuses.has(ticket.currentStatus)) {
      return { kind: "terminal" };
    }

    if (ticket.version !== input.version) {
      return { kind: "version-conflict" };
    }

    const assignee = await database.user.findUnique({
      select: { isActive: true, role: true },
      where: { id: assigneeId },
    });

    if (!isEligibleActionUser(assignee)) {
      return { kind: "assignee-ineligible" };
    }

    const now = new Date();
    const action = await database.actionTaken.create({
      data: {
        assigneeId,
        attachmentNotes: input.attachmentNotes,
        createdAt: now,
        createdByUserId: actorId,
        description: input.description,
        followUpNote: input.followUpNote,
        followUpRequired: input.followUpRequired,
        payloadHash: hash,
        requestId: input.requestId,
        result: input.result,
        ticketId,
        updatedAt: now,
      },
      include: actionInclude,
    });

    await database.actionEvent.create({
      data: {
        actionId: action.id,
        actionVersion: action.version,
        actorId,
        createdAt: now,
        eventType: "ActionCreated",
        snapshot: createActionSnapshot(payload),
        toStatus: "Planned",
      },
    });

    const updatedTicket = await database.ticket.update({
      data: {
        updatedAt: now,
        version: ticket.version + 1,
      },
      include: ticketDetailInclude,
      where: { id: ticketId },
    });

    return { action, kind: "created", ticket: updatedTicket };
  });

export const findActionsForTicket = async (
  ticketId: number,
  query: ActionListQuery
): Promise<{ items: ActionDatabaseRecord[]; totalItems: number }> =>
  await prisma.$transaction(
    async (database) => {
      const where = { ticketId };
      const totalItems = await database.actionTaken.count({ where });
      const skip = (query.page - 1) * query.pageSize;

      if (skip >= totalItems) {
        return { items: [], totalItems };
      }

      const items = await database.actionTaken.findMany({
        include: actionInclude,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: query.pageSize,
        where,
      });

      return { items, totalItems };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
  );
