import type { ErrorRequestHandler, RequestHandler } from "express";

import { ApiError } from "../errors/api-error.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const createErrorBody = (error: ApiError) => ({
  error: {
    code: error.code,
    ...(error.details === undefined ? {} : { details: error.details }),
    message: error.message,
  },
});

export const apiNotFound: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Resource not found.",
    },
  });
};

export const apiErrorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json(createErrorBody(error));
    return;
  }

  if (isRecord(error) && error.type === "entity.parse.failed") {
    response.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body must contain valid JSON.",
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error.",
    },
  });
};
