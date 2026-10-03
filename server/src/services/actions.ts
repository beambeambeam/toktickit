import { ApiError } from "../errors/api-error.js";
import { createAction, findActionsForTicket } from "../repositories/actions.js";
import { findOwnedTicket, findTicketById } from "../repositories/tickets.js";
import type { ActionListQuery, CreateActionInput } from "../types/actions.js";
import type { UserRoleValue } from "../types/users.js";
import { toActionTaken } from "./action-presenters.js";
import { toTicketDetail } from "./ticket-presenters.js";

const notFound = () =>
  new ApiError(404, "RESOURCE_NOT_FOUND", "Ticket was not found.");

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
        "The selected Action Taken assignee is not currently eligible."
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
  } catch {
    throw new ApiError(
      500,
      "ACTION_LIST_FAILURE",
      "Unable to load Actions Taken."
    );
  }
};
