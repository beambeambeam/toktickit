import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import argon2 from "argon2";

import { ApiError } from "../errors/api-error.js";
import {
  createLoginAttemptReservations,
  createSessionWithPrevious,
  deleteSessionById,
  findUserByEmail,
  releaseLoginAttemptReservations,
  replacePasswordAndSessions,
} from "../repositories/auth.js";
import type { findSessionByTokenHash } from "../repositories/auth.js";
import {
  isValidEmail,
  isValidPasswordLength,
  normalizeEmail,
  validatePassword,
} from "./auth-rules.js";

export const SESSION_COOKIE_NAME = "toktickit_session";
export const CSRF_HEADER_NAME = "X-CSRF-Token";
export const NORMAL_SESSION_SECONDS = 8 * 60 * 60;
export const RESTRICTED_SESSION_SECONDS = 15 * 60;

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$BdyBLziZsrpH3nbQl/eAOg$vUBxU7JMsZWrxwLIu3MiOrxP62z0H7dkMgJeyxsARR4.";
const INVALID_CREDENTIALS_MESSAGE =
  "Unable to sign in. Check your credentials or contact your administrator.";

export type UserRoleValue = "Requester" | "ITStaff" | "Administrator";

export interface PublicUser {
  createdAt: string;
  displayName: string;
  email: string;
  id: number;
  isActive: boolean;
  mustChangePassword: boolean;
  role: "Requester" | "IT Staff" | "Administrator";
  updatedAt: string;
}

export interface AuthResponse {
  csrfToken: string;
  user: PublicUser;
}

export interface IssuedSession {
  auth: AuthResponse;
  maxAge: number;
  token: string;
}

export type AuthenticatedSession = NonNullable<
  Awaited<ReturnType<typeof findSessionByTokenHash>>
>;

const validationError = (field: string, reason: string) =>
  new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
    field,
    reason,
  });

const invalidCredentials = () =>
  new ApiError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);

const rateLimited = (retryAfter: number) =>
  new ApiError(
    429,
    "RATE_LIMITED",
    "Too many sign-in attempts. Try again later.",
    undefined,
    retryAfter
  );

const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const createOpaqueToken = (): string => randomBytes(32).toString("base64url");

const createCsrfSecret = (): string => randomBytes(32).toString("base64url");

const roleLabel = (role: UserRoleValue): PublicUser["role"] => {
  if (role === "ITStaff") {
    return "IT Staff";
  }

  return role;
};

export const toPublicUser = (user: {
  createdAt: Date;
  displayName: string;
  email: string;
  id: number;
  isActive: boolean;
  mustChangePassword: boolean;
  role: UserRoleValue;
  updatedAt: Date;
}): PublicUser => ({
  createdAt: user.createdAt.toISOString(),
  displayName: user.displayName,
  email: user.email,
  id: user.id,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  role: roleLabel(user.role),
  updatedAt: user.updatedAt.toISOString(),
});

const isExactObject = (
  value: unknown,
  fields: readonly string[]
): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);
  return (
    keys.length === fields.length &&
    fields.every((field) => keys.includes(field))
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const verifyPassword = async (hash: string | null, password: string) => {
  try {
    return await argon2.verify(hash ?? DUMMY_PASSWORD_HASH, password);
  } catch {
    return false;
  }
};

const hashPassword = async (password: string): Promise<string> =>
  await argon2.hash(password, {
    hashLength: 32,
    memoryCost: 19_456,
    parallelism: 1,
    timeCost: 2,
    type: argon2.argon2id,
  });

const reserveAttempts = async (
  email: string | undefined,
  ip: string,
  now: Date
) => {
  const result = await createLoginAttemptReservations({
    accountKey: email === undefined ? undefined : `account:${email}`,
    ipKey: `ip:${ip}`,
    now,
  });

  if (result.retryAfter > 0) {
    throw rateLimited(result.retryAfter);
  }

  return result.reservationIds;
};

const issueSession = async (
  userId: number,
  restricted: boolean,
  previousTokenHash?: string,
  now = new Date()
): Promise<IssuedSession> => {
  const token = createOpaqueToken();
  const csrfToken = createCsrfSecret();
  const maxAge = restricted
    ? RESTRICTED_SESSION_SECONDS
    : NORMAL_SESSION_SECONDS;
  const absoluteExpiresAt = new Date(now.getTime() + maxAge * 1000);
  const session = await createSessionWithPrevious({
    absoluteExpiresAt,
    createdAt: now,
    csrfSecret: csrfToken,
    id: randomUUID(),
    lastSeenAt: now,
    previousTokenHash,
    restricted,
    tokenHash: hashSessionToken(token),
    userId,
  });

  return {
    auth: {
      csrfToken,
      user: toPublicUser(session.user),
    },
    maxAge,
    token,
  };
};

export const login = async (
  body: unknown,
  ip: string,
  previousToken?: string
) => {
  const record = isRecord(body) ? body : {};
  const emailValue = record.email;
  const now = new Date();

  if (
    !isExactObject(record, ["email", "password"]) ||
    typeof emailValue !== "string" ||
    typeof record.password !== "string"
  ) {
    await reserveAttempts(undefined, ip, now);
    throw validationError("body", "Email and password are required.");
  }

  const email = normalizeEmail(emailValue);
  const { password } = record;

  if (!isValidEmail(email)) {
    await reserveAttempts(undefined, ip, now);
    throw validationError("email", "Enter a valid email address.");
  }

  if (!isValidPasswordLength(password)) {
    await reserveAttempts(undefined, ip, now);
    throw validationError(
      "password",
      "Password must contain 15–128 Unicode characters."
    );
  }

  const reservationIds = await reserveAttempts(email, ip, now);
  const user = await findUserByEmail(email);
  const matches = await verifyPassword(user?.passwordHash ?? null, password);

  if (!matches) {
    throw invalidCredentials();
  }

  await releaseLoginAttemptReservations(reservationIds);

  if (user === null || user.passwordHash === null) {
    throw invalidCredentials();
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      "ACCOUNT_INACTIVE",
      "This account is inactive. Contact your administrator."
    );
  }

  return await issueSession(
    user.id,
    user.mustChangePassword,
    previousToken === undefined ? undefined : hashSessionToken(previousToken)
  );
};

export const getAuthResponse = (
  session: AuthenticatedSession
): AuthResponse => ({
  csrfToken: session.csrfSecret,
  user: toPublicUser(session.user),
});

export const changePassword = async (
  session: AuthenticatedSession,
  body: unknown,
  ip: string
): Promise<IssuedSession> => {
  if (!isExactObject(body, ["currentPassword", "newPassword"])) {
    throw validationError(
      "body",
      "Current password and new password are required."
    );
  }

  const {
    currentPassword: currentPasswordValue,
    newPassword: newPasswordValue,
  } = body;
  const currentPassword = validatePassword(
    currentPasswordValue,
    "currentPassword"
  );
  const newPassword = validatePassword(newPasswordValue, "newPassword");
  const reservationIds = await reserveAttempts(
    session.user.email,
    ip,
    new Date()
  );
  const currentHash = session.user.passwordHash;
  const matches = await verifyPassword(currentHash, currentPassword);

  if (!matches || currentHash === null) {
    throw validationError("currentPassword", "Current password is incorrect.");
  }

  const reused = await verifyPassword(currentHash, newPassword);

  if (reused) {
    await releaseLoginAttemptReservations(reservationIds);
    throw validationError(
      "newPassword",
      "New password must be different from the current password."
    );
  }

  const newPasswordHash = await hashPassword(newPassword);
  const token = createOpaqueToken();
  const csrfToken = createCsrfSecret();
  const now = new Date();
  const replaced = await replacePasswordAndSessions({
    absoluteExpiresAt: new Date(now.getTime() + NORMAL_SESSION_SECONDS * 1000),
    csrfSecret: csrfToken,
    currentPasswordHash: currentHash,
    id: randomUUID(),
    newPasswordHash,
    restricted: false,
    sessionId: session.id,
    tokenHash: hashSessionToken(token),
    userId: session.user.id,
  });

  if (replaced === null) {
    throw new ApiError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required."
    );
  }

  await releaseLoginAttemptReservations(reservationIds);
  return {
    auth: {
      csrfToken,
      user: toPublicUser(replaced.user),
    },
    maxAge: NORMAL_SESSION_SECONDS,
    token,
  };
};

export const revokeSession = async (sessionId: string) => {
  await deleteSessionById(sessionId);
};

export const sessionTokenHash = hashSessionToken;

export const compareCsrfToken = (
  provided: string,
  expected: string
): boolean => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};
