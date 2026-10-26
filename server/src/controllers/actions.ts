import type { RequestHandler } from "express";

import {
  getAuthenticatedUser,
  getAuthenticatedUserId,
} from "../middlewares/auth-context.js";
import {
  parseActionListQuery,
  validateActionTransitionInput,
  validateCreateActionInput,
  validateEditActionInput,
} from "../services/action-rules.js";
import {
  createActionForStaff,
  editActionForStaff,
  listActionHistoryForReader,
  listActionsForReader,
  listMyActions,
  transitionActionForStaff,
} from "../services/actions.js";
import { parsePositiveId } from "../utils/parse-id.js";

export const getActions: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(response);
  const actions = await listActionsForReader(
    user.id,
    user.role,
    parsePositiveId(request.params.ticketId, "ticketId"),
    parseActionListQuery(request.query)
  );

  response.json(actions);
};

export const getStaffActions: RequestHandler = async (request, response) => {
  const actions = await listMyActions(
    getAuthenticatedUserId(response),
    parseActionListQuery(request.query)
  );

  response.json(actions);
};

export const getActionHistory: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(response);
  const history = await listActionHistoryForReader(
    user.id,
    user.role,
    parsePositiveId(request.params.ticketId, "ticketId"),
    parsePositiveId(request.params.actionId, "actionId"),
    parseActionListQuery(request.query)
  );

  response.json(history);
};

export const createAction: RequestHandler = async (request, response) => {
  const result = await createActionForStaff(
    getAuthenticatedUserId(response),
    parsePositiveId(request.params.ticketId, "ticketId"),
    validateCreateActionInput(request.body)
  );

  response.status(result.replayed ? 200 : 201).json({
    action: result.action,
    ticket: result.ticket,
  });
};

export const editAction: RequestHandler = async (request, response) => {
  const result = await editActionForStaff(
    getAuthenticatedUserId(response),
    parsePositiveId(request.params.ticketId, "ticketId"),
    parsePositiveId(request.params.actionId, "actionId"),
    validateEditActionInput(request.body)
  );

  response.json(result);
};

export const transitionAction: RequestHandler = async (request, response) => {
  const result = await transitionActionForStaff(
    getAuthenticatedUserId(response),
    parsePositiveId(request.params.ticketId, "ticketId"),
    parsePositiveId(request.params.actionId, "actionId"),
    validateActionTransitionInput(request.body)
  );

  response.json(result);
};
