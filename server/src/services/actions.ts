import { ApiError } from "../errors/api-error.js";
import {
  createAction,
  editAction,
  findActionHistoryForTicket,
  findActionsForTicket,
} from "../repositories/actions.js";
import { findOwnedTicket, findTicketById } from "../repositories/tickets.js";
import type {
  ActionListQuery,
  CreateActionInput,
  EditActionInput,
} from "../types/actions.js";
import type { UserRoleValue } from "../types/users.js";
import { toActionEvent, toActionTaken } from "./action-presenters.js";
import { toTicketDetail } from "./ticket-presenters.js";

const notFound = () =>
  new ApiError(404, "RESOURCE_NOT_FOUND", "Ticket was not found.");

const actionNotFound = () =>
  new ApiError(404, "RESOURCE_NOT_FOUND", "Action Taken was not found.");

const readerCanAccessAnyTicket = (role: UserRoleValue): boolean =>
  role === "ITStaff" || role === "Administrator";

const resolveCreateOutcome = (
  outcome: Awaited<ReturnType<typeof createAction>>
) => {
  switch (outcome.kind) {
    case "actor-ineligible": {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You do not have permission to create Actions Taken."
      );
    }
    case "assignee-ineligible": {
      throw new ApiError(
        409,
        "ACTION_ASSIGNEE_INELIGIBLE",
        "The selected Action Taken assignee is not currently eligible.",
        {
          field: "assigneeId",
          reason: "Choose an active IT Staff member or Administrator.",
        }
      );
    }
    case "not-found": {
      throw notFound();
    }
    case "request-id-conflict": {
      throw new ApiError(
        409,
        "REQUEST_ID_CONFLICT",
        "This request ID was already used with different Action Taken data."
      );
    }
    case "terminal": {
      throw new ApiError(
        409,
        "TICKET_TERMINAL",
        "Resolved, Closed or Cancelled Tickets cannot receive new Actions Taken."
      );
    }
    case "version-conflict": {
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "The Ticket changed before this Action Taken was saved.",
        { field: "version", reason: "The supplied version is stale." }
      );
    }
    case "created":
    case "replayed": {
      return {
        action: toActionTaken(outcome.action),
        replayed: outcome.kind === "replayed",
        ticket: toTicketDetail(outcome.ticket),
      };
    }
    default: {
      throw new ApiError(
        500,
        "INTERNAL_ERROR",
        "Unable to create the Action Taken."
      );
    }
  }
};

export const createActionForStaff = async (
  actorId: number,
  ticketId: number,
  input: CreateActionInput
) => resolveCreateOutcome(await createAction(actorId, ticketId, input));

const resolveEditOutcome = (
  outcome: Awaited<ReturnType<typeof editAction>>
) => {
  switch (outcome.kind) {
    case "actor-ineligible": {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You do not have permission to edit Actions Taken."
      );
    }
    case "actor-inactive": {
      throw new ApiError(
        403,
        "ACCOUNT_INACTIVE",
        "This account is inactive. Contact your administrator."
      );
    }
    case "action-terminal": {
      throw new ApiError(
        409,
        "ACTION_TERMINAL",
        "Completed or Cancelled Actions Taken cannot be edited."
      );
    }
    case "assignee-ineligible": {
      throw new ApiError(
        409,
        "ACTION_ASSIGNEE_INELIGIBLE",
        "The selected Action Taken assignee is not currently eligible.",
        {
          field: "assigneeId",
          reason: "Choose an active IT Staff member or Administrator.",
        }
      );
    }
    case "not-found": {
      throw actionNotFound();
    }
    case "ticket-terminal": {
      throw new ApiError(
        409,
        "TICKET_TERMINAL",
        "Resolved, Closed or Cancelled Tickets cannot have Actions Taken edited."
      );
    }
    case "version-conflict": {
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "The Action Taken or Ticket changed before this edit was saved.",
        { field: outcome.field, reason: "The supplied version is stale." }
      );
    }
    case "edited":
    case "unchanged": {
      return {
        action: toActionTaken(outcome.action),
        ticket: toTicketDetail(outcome.ticket),
      };
    }
    default: {
      throw new ApiError(
        500,
        "INTERNAL_ERROR",
        "Unable to edit the Action Taken."
      );
    }
  }
};

export const editActionForStaff = async (
  actorId: number,
  ticketId: number,
  actionId: number,
  input: EditActionInput
) => resolveEditOutcome(await editAction(actorId, ticketId, actionId, input));

export const listActionsForReader = async (
  userId: number,
  role: UserRoleValue,
  ticketId: number,
  query: ActionListQuery
) => {
  const ticket = readerCanAccessAnyTicket(role)
    ? await findTicketById(ticketId)
    : await findOwnedTicket(userId, ticketId);

  if (ticket === null) {
    throw notFound();
  }

  try {
    const result = await findActionsForTicket(ticketId, query);

    return {
      items: result.items.map(toActionTaken),
      page: query.page,
      pageSize: query.pageSize,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / query.pageSize),
    };
  } catch (error: unknown) {
    console.error("Unable to load Actions Taken.", error);
    throw new ApiError(500, "INTERNAL_ERROR", "Unable to load Actions Taken.");
  }
};

export const listActionHistoryForReader = async (
  userId: number,
  role: UserRoleValue,
  ticketId: number,
  actionId: number,
  query: ActionListQuery
) => {
  const ticket = readerCanAccessAnyTicket(role)
    ? await findTicketById(ticketId)
    : await findOwnedTicket(userId, ticketId);

  if (ticket === null) {
    throw notFound();
  }

  try {
    const result = await findActionHistoryForTicket(ticketId, actionId, query);

    if (result.kind === "not-found") {
      throw actionNotFound();
    }

    return {
      items: result.items.map(toActionEvent),
      page: query.page,
      pageSize: query.pageSize,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / query.pageSize),
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("Unable to load Action Taken history.", error);
    throw new ApiError(
      500,
      "INTERNAL_ERROR",
      "Unable to load Action Taken history."
    );
  }
};
