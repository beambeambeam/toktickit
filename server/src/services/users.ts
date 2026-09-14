import { ApiError } from "../errors/api-error.js";
import { UserEmailConflictError } from "../errors/user-errors.js";
import { createUser, findUsers } from "../repositories/users.js";
import { hashPassword, toPublicUser } from "./auth.js";
import { parseUserListQuery, validateCreateUser } from "./user-rules.js";

const internalError = () =>
  new ApiError(
    500,
    "INTERNAL_ERROR",
    "Unable to complete the request. Please try again."
  );

const emailConflict = () =>
  new ApiError(409, "EMAIL_CONFLICT", "A user with that email already exists.");

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
