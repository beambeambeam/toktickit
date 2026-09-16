import { ApiError } from "../errors/api-error.js";
import { UserEmailConflictError } from "../errors/user-errors.js";
import {
  createUser,
  findUserById,
  findUsers,
  resetUserInitialPassword,
  updateUserAccount,
} from "../repositories/users.js";
import { hashPassword, toPublicUser } from "./auth.js";
import {
  parseUserListQuery,
  validateCreateUser,
  validateResetInitialPassword,
  validateUpdateUser,
} from "./user-rules.js";

const internalError = () =>
  new ApiError(
    500,
    "INTERNAL_ERROR",
    "Unable to complete the request. Please try again."
  );

const emailConflict = () =>
  new ApiError(409, "EMAIL_CONFLICT", "A user with that email already exists.");

const forbidden = () =>
  new ApiError(
    403,
    "FORBIDDEN",
    "You do not have permission to access this resource."
  );

const notFound = () =>
  new ApiError(404, "RESOURCE_NOT_FOUND", "User was not found.");

const selfDeactivation = () =>
  new ApiError(
    409,
    "SELF_DEACTIVATION",
    "You cannot deactivate your own Administrator account."
  );

const lastAdministrator = () =>
  new ApiError(
    409,
    "LAST_ADMIN_REQUIRED",
    "At least one active Administrator account must remain."
  );

export const listUsers = async (query: unknown) => {
  const filters = parseUserListQuery(query);

  try {
    const users = await findUsers(filters);
    return users.map(toPublicUser);
  } catch {
    throw internalError();
  }
};

export const createUserAccount = async (body: unknown) => {
  const input = validateCreateUser(body);
  const initialPasswordHash = await hashPassword(input.initialPassword);

  try {
    const user = await createUser({
      displayName: input.displayName,
      email: input.email,
      initialPasswordHash,
      isActive: input.isActive,
      role: input.role,
    });

    return toPublicUser(user);
  } catch (error: unknown) {
    if (error instanceof UserEmailConflictError) {
      throw emailConflict();
    }

    throw internalError();
  }
};

export const getUserAccount = async (userId: number) => {
  try {
    const user = await findUserById(userId);
    if (user === null) {
      throw notFound();
    }

    return toPublicUser(user);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw internalError();
  }
};

const resolveUpdateOutcome = (
  outcome: Awaited<ReturnType<typeof updateUserAccount>>
) => {
  switch (outcome.kind) {
    case "forbidden": {
      throw forbidden();
    }
    case "last-admin": {
      throw lastAdministrator();
    }
    case "not-found": {
      throw notFound();
    }
    case "self-deactivation": {
      throw selfDeactivation();
    }
    case "success": {
      return {
        sessionRevoked: outcome.sessionRevoked,
        user: toPublicUser(outcome.user),
      };
    }
    default: {
      throw internalError();
    }
  }
};

export const updateUserAccountDetails = async (
  actorId: number,
  userId: number,
  body: unknown
) => {
  const changes = validateUpdateUser(body);

  try {
    return resolveUpdateOutcome(
      await updateUserAccount({ actorId, changes, targetId: userId })
    );
  } catch (error: unknown) {
    if (error instanceof UserEmailConflictError) {
      throw emailConflict();
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw internalError();
  }
};

export const resetUserAccountInitialPassword = async (
  actorId: number,
  userId: number,
  body: unknown
) => {
  const input = validateResetInitialPassword(body);
  const initialPasswordHash = await hashPassword(input.initialPassword);

  try {
    const outcome = await resetUserInitialPassword({
      actorId,
      initialPasswordHash,
      targetId: userId,
    });

    switch (outcome.kind) {
      case "forbidden": {
        throw forbidden();
      }
      case "not-found": {
        throw notFound();
      }
      case "success": {
        return {
          sessionRevoked: outcome.sessionRevoked,
          user: toPublicUser(outcome.user),
        };
      }
      default: {
        throw internalError();
      }
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw internalError();
  }
};
