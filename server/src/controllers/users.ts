import type { RequestHandler } from "express";

import { ApiError } from "../errors/api-error.js";
import {
  getAuthenticatedUserId,
  clearSessionCookie,
} from "../middlewares/auth-context.js";
import {
  createUserAccount,
  getUserAccount,
  listUsers,
  resetUserAccountInitialPassword,
  updateUserAccountDetails,
} from "../services/users.js";

const parseId = (value: unknown): number => {
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "userId",
      reason: "userId must be a positive integer.",
    });
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2_147_483_647) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "userId",
      reason: "userId must be a positive integer.",
    });
  }

  return id;
};

export const getUsers: RequestHandler = async (request, response) => {
  response.json({ items: await listUsers(request.query) });
};

export const createUser: RequestHandler = async (request, response) => {
  const user = await createUserAccount(request.body);
  response.status(201).json({ user });
};

export const getUser: RequestHandler = async (request, response) => {
  const user = await getUserAccount(parseId(request.params.userId));
  response.json(user);
};

export const updateUser: RequestHandler = async (request, response) => {
  const userId = parseId(request.params.userId);
  const actorId = getAuthenticatedUserId(response);
  const result = await updateUserAccountDetails(actorId, userId, request.body);

  if (result.sessionRevoked && actorId === userId) {
    clearSessionCookie(response);
  }

  response.json({ user: result.user });
};

export const resetUserInitialPassword: RequestHandler = async (
  request,
  response
) => {
  const userId = parseId(request.params.userId);
  const actorId = getAuthenticatedUserId(response);
  const result = await resetUserAccountInitialPassword(
    actorId,
    userId,
    request.body
  );

  if (result.sessionRevoked && actorId === userId) {
    clearSessionCookie(response);
  }

  response.json({ user: result.user });
};
