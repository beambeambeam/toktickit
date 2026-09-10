import type { RequestHandler, Request, Response } from "express";

import { corsConfig } from "../config/cors.js";
import { ApiError } from "../errors/api-error.js";
import {
  findSessionByTokenHash,
  updateSessionLastSeen,
  deleteSessionByTokenHash,
} from "../repositories/auth.js";
import {
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
  compareCsrfToken,
  getAuthResponse,
  sessionTokenHash,
} from "../services/auth.js";

export interface AuthLocals {
  session: NonNullable<Awaited<ReturnType<typeof findSessionByTokenHash>>>;
}

const authRequiredError = () =>
  new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");

const invalidOriginError = () =>
  new ApiError(
    403,
    "ORIGIN_FORBIDDEN",
    "This request origin is not permitted."
  );

const invalidCsrfError = () =>
  new ApiError(403, "CSRF_INVALID", "The CSRF token is invalid.");

const passwordChangeRequiredError = () =>
  new ApiError(
    403,
    "PASSWORD_CHANGE_REQUIRED",
    "Change your password before accessing this resource."
  );

const forbiddenError = () =>
  new ApiError(
    403,
    "FORBIDDEN",
    "You do not have permission to access this resource."
  );

const inactiveError = () =>
  new ApiError(
    403,
    "ACCOUNT_INACTIVE",
    "This account is inactive. Contact your administrator."
  );

const cookieSecure = corsConfig.API_ORIGIN.startsWith("https:");

const cookieAttributes = (maxAge: number): string =>
  `Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${
    cookieSecure ? "; Secure" : ""
  }`;

export const setSessionCookie = (
  response: Response,
  token: string,
  maxAge: number
) => {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; ${cookieAttributes(maxAge)}`
  );
};

export const clearSessionCookie = (response: Response) => {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; ${cookieAttributes(0)}`
  );
};

const getCookie = (request: Request, name: string): string | undefined => {
  const header = request.get("Cookie");

  if (header === undefined) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }

    const value = part.slice(separator + 1).trim();
    return value.length > 0 ? value : undefined;
  }

  return undefined;
};

export const getSessionToken = (request: Request): string | undefined =>
  getCookie(request, SESSION_COOKIE_NAME);

const setNoStore = (response: Response) => {
  response.set("Cache-Control", "no-store");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const isUserRole = (
  value: unknown
): value is "Requester" | "ITStaff" | "Administrator" =>
  value === "Requester" || value === "ITStaff" || value === "Administrator";

const isAuthenticatedSession = (
  value: unknown
): value is AuthLocals["session"] => {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  const { user } = value;
  return (
    typeof value.id === "string" &&
    typeof value.tokenHash === "string" &&
    typeof value.csrfSecret === "string" &&
    isDate(value.createdAt) &&
    isDate(value.lastSeenAt) &&
    isDate(value.absoluteExpiresAt) &&
    typeof value.restricted === "boolean" &&
    isDate(user.createdAt) &&
    typeof user.displayName === "string" &&
    typeof user.email === "string" &&
    typeof user.id === "number" &&
    typeof user.isActive === "boolean" &&
    typeof user.mustChangePassword === "boolean" &&
    (typeof user.passwordHash === "string" || user.passwordHash === null) &&
    isUserRole(user.role) &&
    isDate(user.updatedAt)
  );
};

const getSession = (response: Response): AuthLocals["session"] => {
  const locals: unknown = response.locals;

  if (!isRecord(locals) || !isAuthenticatedSession(locals.session)) {
    throw authRequiredError();
  }

  return locals.session;
};

const allowedOrigins = (): ReadonlySet<string> =>
  new Set([corsConfig.API_ORIGIN, corsConfig.CORS_ORIGIN]);

export const requireAllowedOrigin: RequestHandler = (
  request,
  _response,
  next
) => {
  const origin = request.get("Origin");

  if (
    origin === undefined ||
    origin === "null" ||
    !allowedOrigins().has(origin)
  ) {
    next(invalidOriginError());
    return;
  }

  next();
};

export const requireSession: RequestHandler = async (
  request,
  response,
  next
) => {
  setNoStore(response);
  const token = getSessionToken(request);

  if (token === undefined) {
    clearSessionCookie(response);
    next(authRequiredError());
    return;
  }

  const session = await findSessionByTokenHash(sessionTokenHash(token));
  const now = new Date();

  if (
    session === null ||
    now >= session.absoluteExpiresAt ||
    (!session.restricted &&
      now.getTime() >= session.lastSeenAt.getTime() + 30 * 60 * 1000)
  ) {
    if (session !== null) {
      await deleteSessionByTokenHash(session.tokenHash);
    }
    clearSessionCookie(response);
    next(authRequiredError());
    return;
  }

  if (!session.user.isActive) {
    await deleteSessionByTokenHash(session.tokenHash);
    clearSessionCookie(response);
    next(inactiveError());
    return;
  }

  response.locals.session = session;
  next();
};

export const requireUnrestricted: RequestHandler = (
  _request,
  response,
  next
) => {
  const session = getSession(response);

  if (session.user.mustChangePassword || session.restricted) {
    next(passwordChangeRequiredError());
    return;
  }

  next();
};

export const requireRole =
  (...roles: readonly string[]): RequestHandler =>
  (_request, response, next) => {
    const session = getSession(response);

    if (!roles.includes(session.user.role)) {
      next(forbiddenError());
      return;
    }

    next();
  };

export const touchSession: RequestHandler = async (
  _request,
  response,
  next
) => {
  const session = getSession(response);

  if (!session.restricted) {
    const now = new Date();
    await updateSessionLastSeen(session.id, now);
    session.lastSeenAt = now;
  }

  next();
};

export const requireCsrf: RequestHandler = (request, response, next) => {
  const session = getSession(response);
  const provided = request.get(CSRF_HEADER_NAME);

  if (
    provided === undefined ||
    !compareCsrfToken(provided, session.csrfSecret)
  ) {
    next(invalidCsrfError());
    return;
  }

  next();
};

export const getAuthenticatedSession = getSession;

export const getAuthenticatedUser = (response: Response) =>
  getSession(response).user;

export const getAuthenticatedUserId = (response: Response): number =>
  getSession(response).user.id;

export const getAuthenticatedResponse = (response: Response) =>
  getAuthResponse(getSession(response));
