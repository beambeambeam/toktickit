import type { ErrorRequestHandler, RequestHandler } from "express";

const getErrorMessage = (error: unknown): string | undefined => {
  if (
    typeof error !== "object" ||
    error === null ||
    !("message" in error) ||
    typeof error.message !== "string" ||
    error.message.length === 0
  ) {
    return undefined;
  }

  return error.message;
};

export const apiNotFound: RequestHandler = (_request, response) => {
  response.status(404).json({ message: "Not Found" });
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

  const message = getErrorMessage(error) ?? "Internal Server Error";

  response.status(500).json({ message });
};
