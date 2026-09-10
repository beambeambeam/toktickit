import type { RequestHandler } from "express";

import {
  clearSessionCookie,
  getAuthenticatedSession,
  getSessionToken,
  setSessionCookie,
} from "../middlewares/auth-context.js";
import {
  changePassword as replacePassword,
  getAuthResponse,
  login as authenticate,
  revokeSession,
} from "../services/auth.js";

export const login: RequestHandler = async (request, response) => {
  const issued = await authenticate(
    request.body,
    request.ip ?? "unknown",
    getSessionToken(request)
  );

  setSessionCookie(response, issued.token, issued.maxAge);
  response.json(issued.auth);
};

export const getMe: RequestHandler = (_request, response) => {
  response.json(getAuthResponse(getAuthenticatedSession(response)));
};

export const changePassword: RequestHandler = async (request, response) => {
  const issued = await replacePassword(
    getAuthenticatedSession(response),
    request.body,
    request.ip ?? "unknown"
  );

  setSessionCookie(response, issued.token, issued.maxAge);
  response.json(issued.auth);
};

export const logout: RequestHandler = async (_request, response) => {
  await revokeSession(getAuthenticatedSession(response).id);
  clearSessionCookie(response);
  response.status(204).end();
};
