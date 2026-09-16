import { ApiError } from "../errors/api-error.js";
import type {
  CreateUserInput,
  ResetInitialPasswordInput,
  UpdateUserInput,
  UserListQuery,
  UserRoleValue,
} from "../types/users.js";
import { validateEmail, validatePassword } from "./auth-rules.js";

export const MAX_DISPLAY_NAME_CODE_POINTS = 100;
export const MAX_USER_SEARCH_CODE_POINTS = 200;

export const USER_ROLE_LABELS = [
  "Requester",
  "IT Staff",
  "Administrator",
] as const;

export type UserRoleLabel = (typeof USER_ROLE_LABELS)[number];

const validationError = (field: string, reason: string): ApiError =>
  new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
    field,
    reason,
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isExactObject = (
  value: unknown,
  fields: readonly string[]
): value is Record<string, unknown> => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);
  return (
    keys.length === fields.length &&
    fields.every((field) => keys.includes(field))
  );
};

const codePointLength = (value: string): number =>
  // oxlint-disable-next-line unicorn/prefer-spread -- user contract counts Unicode code points.
  Array.from(value).length;

const isUserRoleLabel = (value: unknown): value is UserRoleLabel =>
  USER_ROLE_LABELS.some((role) => role === value);

export const userRoleFromLabel = (value: UserRoleLabel): UserRoleValue => {
  if (value === "IT Staff") {
    return "ITStaff";
  }

  return value;
};

export const validateDisplayName = (value: unknown): string => {
  if (typeof value !== "string") {
    throw validationError("displayName", "Name is required.");
  }

  const displayName = value.trim();
  const length = codePointLength(displayName);

  if (length < 1 || length > MAX_DISPLAY_NAME_CODE_POINTS) {
    throw validationError(
      "displayName",
      "Name must contain 1–100 Unicode characters after trimming."
    );
  }

  return displayName;
};

export const parseUserListQuery = (query: unknown): UserListQuery => {
  if (!isRecord(query)) {
    throw validationError("query", "Query parameters are invalid.");
  }

  const allowedFields = ["role", "search"] as const;
  for (const field of Object.keys(query)) {
    if (!allowedFields.some((allowedField) => allowedField === field)) {
      throw validationError("query", `Unknown query parameter: ${field}.`);
    }
  }

  const searchValue = query.search;
  const roleValue = query.role;
  let search: string | undefined;
  let role: UserRoleValue | undefined;

  if (searchValue !== undefined) {
    if (typeof searchValue !== "string") {
      throw validationError("search", "Search must be a single text value.");
    }

    const normalizedSearch = searchValue.trim();
    if (codePointLength(normalizedSearch) > MAX_USER_SEARCH_CODE_POINTS) {
      throw validationError(
        "search",
        "Search must contain at most 200 Unicode characters."
      );
    }

    if (normalizedSearch.length > 0) {
      search = normalizedSearch;
    }
  }

  if (roleValue !== undefined) {
    if (typeof roleValue !== "string" || !isUserRoleLabel(roleValue)) {
      throw validationError(
        "role",
        "Role must be Requester, IT Staff, or Administrator."
      );
    }

    role = userRoleFromLabel(roleValue);
  }

  return {
    ...(role === undefined ? {} : { role }),
    ...(search === undefined ? {} : { search }),
  };
};

export const validateCreateUser = (body: unknown): CreateUserInput => {
  if (
    !isExactObject(body, [
      "displayName",
      "email",
      "role",
      "isActive",
      "initialPassword",
    ])
  ) {
    throw validationError(
      "body",
      "Name, email, role, activation state, and initial password are required."
    );
  }

  const displayName = validateDisplayName(body.displayName);
  const email = validateEmail(body.email);

  if (typeof body.role !== "string" || !isUserRoleLabel(body.role)) {
    throw validationError(
      "role",
      "Role must be Requester, IT Staff, or Administrator."
    );
  }

  if (typeof body.isActive !== "boolean") {
    throw validationError("isActive", "Activation state must be a boolean.");
  }

  const initialPassword = validatePassword(
    body.initialPassword,
    "initialPassword"
  );

  return {
    displayName,
    email,
    initialPassword,
    isActive: body.isActive,
    role: userRoleFromLabel(body.role),
  };
};

export const validateUpdateUser = (body: unknown): UpdateUserInput => {
  if (!isRecord(body)) {
    throw validationError("body", "Request body must be an object.");
  }

  const allowedFields = ["displayName", "email", "role", "isActive"] as const;
  const keys = Object.keys(body);

  if (keys.length === 0) {
    throw validationError(
      "body",
      "At least one editable account field is required."
    );
  }

  const unknownField = keys.find(
    (key) => !allowedFields.some((allowedField) => allowedField === key)
  );
  if (unknownField !== undefined) {
    throw validationError("body", `Unknown account field: ${unknownField}.`);
  }

  const input: UpdateUserInput = {};

  if ("displayName" in body) {
    input.displayName = validateDisplayName(body.displayName);
  }

  if ("email" in body) {
    input.email = validateEmail(body.email);
  }

  if ("role" in body) {
    if (typeof body.role !== "string" || !isUserRoleLabel(body.role)) {
      throw validationError(
        "role",
        "Role must be Requester, IT Staff, or Administrator."
      );
    }

    input.role = userRoleFromLabel(body.role);
  }

  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") {
      throw validationError("isActive", "Activation state must be a boolean.");
    }

    input.isActive = body.isActive;
  }

  return input;
};

export const validateResetInitialPassword = (
  body: unknown
): ResetInitialPasswordInput => {
  if (!isExactObject(body, ["initialPassword", "confirmed"])) {
    throw validationError(
      "body",
      "Initial password and confirmation are required."
    );
  }

  if (body.confirmed !== true) {
    throw validationError(
      "confirmed",
      "Confirm that all target sessions will end."
    );
  }

  return {
    confirmed: true,
    initialPassword: validatePassword(body.initialPassword, "initialPassword"),
  };
};
