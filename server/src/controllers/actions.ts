import type { RequestHandler } from "express";

import {
  getAuthenticatedUser,
  getAuthenticatedUserId,
} from "../middlewares/auth-context.js";
import {
  parseActionListQuery,
  validateCreateActionInput,
} from "../services/action-rules.js";
import {
  createActionForStaff,
  listActionsForReader,
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
