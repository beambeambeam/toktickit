import type { RequestHandler, Response } from "express";

import { ApiError } from "../errors/api-error.js";
import { requireActiveDevelopmentRequester } from "../services/reference-data.js";

export const DEVELOPMENT_REQUESTER_HEADER = "X-Development-Requester-Id";

interface RequesterLocals {
  developmentRequester: { id: number };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRequesterLocals = (value: unknown): value is RequesterLocals =>
  isRecord(value) &&
  isRecord(value.developmentRequester) &&
  typeof value.developmentRequester.id === "number";

const requesterContextError = () =>
  new ApiError(
    400,
    "INVALID_REQUESTER_CONTEXT",
    "A valid active Development Requester context is required."
  );

const parseRequesterId = (value: string | undefined): number => {
  if (value === undefined || !/^[1-9]\d*$/u.test(value)) {
    throw requesterContextError();
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw requesterContextError();
  }

  return id;
};

export const requireRequesterContext: RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  unknown,
  RequesterLocals
> = async (request, response, next) => {
  const requesterId = parseRequesterId(
    request.get(DEVELOPMENT_REQUESTER_HEADER)
  );
  const requester = await requireActiveDevelopmentRequester(requesterId);

  if (requester === null) {
    next(requesterContextError());
    return;
  }

  response.locals.developmentRequester = requester;
  next();
};

export const getRequesterId = (response: Response): number => {
  const locals: unknown = response.locals;

  if (!isRequesterLocals(locals)) {
    throw requesterContextError();
  }

  return locals.developmentRequester.id;
};
