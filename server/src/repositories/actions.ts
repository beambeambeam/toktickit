import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type {
  ActionStatus as PrismaActionStatus,
  CurrentStatus as PrismaCurrentStatus,
} from "../generated/prisma/enums.js";
import {
  createActionSnapshot,
  getActionPayload,
  hashActionPayload,
} from "../models/action-payload.js";
import type {
  ActionListQuery,
  CreateActionInput,
  EditActionInput,
} from "../types/actions.js";
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

const actionEventInclude = {
  actor: { select: { displayName: true, id: true, role: true } },
} satisfies Prisma.ActionEventInclude;

type ActionDatabase = Prisma.TransactionClient;

type ActionDatabaseRecord = Prisma.ActionTakenGetPayload<{
  include: typeof actionInclude;
}>;

type ActionEventDatabaseRecord = Prisma.ActionEventGetPayload<{
  include: typeof actionEventInclude;
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

export type EditActionOutcome =
  | { kind: "actor-ineligible" }
  | { kind: "actor-inactive" }
  | { kind: "action-terminal" }
  | { kind: "assignee-ineligible" }
  | { kind: "not-found" }
  | { kind: "ticket-terminal" }
  | { field: "actionVersion" | "ticketVersion"; kind: "version-conflict" }
  | {
      action: ActionDatabaseRecord;
      kind: "edited" | "unchanged";
      ticket: TicketDetailDatabaseRecord;
    };

export type ActionHistoryOutcome =
  | { kind: "not-found" }
  | { items: ActionEventDatabaseRecord[]; kind: "found"; totalItems: number };

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

const lockAction = async (
  database: ActionDatabase,
  ticketId: number,
  actionId: number
) => {
  await database.$queryRaw(
    Prisma.sql`SELECT "id" FROM "ActionTaken" WHERE "ticketId" = ${ticketId} AND "id" = ${actionId} FOR UPDATE`
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

const sameEditableFields = (
  action: ActionDatabaseRecord,
  input: EditActionInput
): boolean =>
  action.assigneeId === input.assigneeId &&
  action.attachmentNotes === input.attachmentNotes &&
  action.description === input.description &&
  action.followUpNote === input.followUpNote &&
  action.followUpRequired === input.followUpRequired &&
  action.result === input.result;

const editClosedActionStatuses = new Set<PrismaActionStatus>([
  "Completed",
  "Cancelled",
]);

export const editAction = async (
  actorId: number,
  ticketId: number,
  actionId: number,
  input: EditActionInput
): Promise<EditActionOutcome> =>
  await prisma.$transaction(async (database) => {
    // Lock actor and selected assignee before Ticket and Action rows to match
    // account lifecycle writes and prevent eligibility changes racing this edit.
    await lockUsers(database, [actorId, input.assigneeId]);

    const actor = await database.user.findUnique({
      select: { id: true, isActive: true, role: true },
      where: { id: actorId },
    });

    if (actor === null || !actor.isActive) {
      return { kind: "actor-inactive" };
    }

    if (!isEligibleActionUser(actor)) {
      return { kind: "actor-ineligible" };
    }

    await lockTicket(database, ticketId);
    const ticket = await findLockedTicket(database, ticketId);

    if (ticket === null) {
      return { kind: "not-found" };
    }

    await lockAction(database, ticketId, actionId);
    const action = await database.actionTaken.findUnique({
      include: actionInclude,
      where: { id: actionId },
    });

    if (action === null || action.ticketId !== ticketId) {
      return { kind: "not-found" };
    }

    if (action.version !== input.actionVersion) {
      return { field: "actionVersion", kind: "version-conflict" };
    }

    if (ticket.version !== input.ticketVersion) {
      return { field: "ticketVersion", kind: "version-conflict" };
    }

    if (actionClosedStatuses.has(ticket.currentStatus)) {
      return { kind: "ticket-terminal" };
    }

    if (editClosedActionStatuses.has(action.status)) {
      return { kind: "action-terminal" };
    }

    if (action.assigneeId !== input.assigneeId) {
      const assignee = await database.user.findUnique({
        select: { isActive: true, role: true },
        where: { id: input.assigneeId },
      });

      if (!isEligibleActionUser(assignee)) {
        return { kind: "assignee-ineligible" };
      }
    }

    if (sameEditableFields(action, input)) {
      return { action, kind: "unchanged", ticket };
    }

    const now = new Date();
    const payload = getActionPayload(input, input.assigneeId);
    const updatedAction = await database.actionTaken.update({
      data: {
        assigneeId: input.assigneeId,
        attachmentNotes: input.attachmentNotes,
        description: input.description,
        followUpNote: input.followUpNote,
        followUpRequired: input.followUpRequired,
        result: input.result,
        updatedAt: now,
        version: action.version + 1,
      },
      include: actionInclude,
      where: { id: actionId },
    });

    await database.actionEvent.create({
      data: {
        actionId,
        actionVersion: updatedAction.version,
        actorId,
        createdAt: now,
        eventType: "ActionEdited",
        fromStatus: action.status,
        snapshot: createActionSnapshot(
          payload,
          action.status === "InProgress" ? "In Progress" : action.status
        ),
        toStatus: action.status,
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

    return { action: updatedAction, kind: "edited", ticket: updatedTicket };
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

export const findActionHistoryForTicket = async (
  ticketId: number,
  actionId: number,
  query: ActionListQuery
): Promise<ActionHistoryOutcome> =>
  await prisma.$transaction(
    async (database) => {
      const action = await database.actionTaken.findFirst({
        select: { id: true },
        where: { id: actionId, ticketId },
      });

      if (action === null) {
        return { kind: "not-found" };
      }

      const where = { actionId };
      const totalItems = await database.actionEvent.count({ where });
      const skip = (query.page - 1) * query.pageSize;

      if (skip >= totalItems) {
        return { items: [], kind: "found", totalItems };
      }

      const items = await database.actionEvent.findMany({
        include: actionEventInclude,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: query.pageSize,
        where,
      });

      return { items, kind: "found", totalItems };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
  );
