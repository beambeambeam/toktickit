import { ApiRequestError } from "@/api/errors";
import type { UserRole } from "@/api/users";
import { isEmail, passwordCodePointLength } from "@/lib/auth-rules";

export const MAX_DISPLAY_NAME_LENGTH = 100;
export const MAX_USER_SEARCH_LENGTH = 200;

export interface UserFormValues {
  displayName: string;
  email: string;
  initialPassword: string;
  isActive: boolean;
  role: UserRole | "";
}

export type UserFieldErrors = Partial<Record<keyof UserFormValues, string>>;

const isUserField = (value: string): value is keyof UserFormValues =>
  value === "displayName" ||
  value === "email" ||
  value === "role" ||
  value === "isActive" ||
  value === "initialPassword";

export const validateUserForm = (values: UserFormValues): UserFieldErrors => {
  const errors: UserFieldErrors = {};
  const displayName = values.displayName.trim();
  const email = values.email.trim();

  if (
    displayName.length < 1 ||
    // oxlint-disable-next-line unicorn/prefer-spread -- user contract counts Unicode code points.
    Array.from(displayName).length > MAX_DISPLAY_NAME_LENGTH
  ) {
    errors.displayName =
      "Name must contain 1–100 Unicode characters after trimming.";
  }

  if (email.length === 0 || email.length > 254 || !isEmail(email)) {
    errors.email = "Enter a valid email address (up to 254 characters).";
  }

  if (values.role === "") {
    errors.role = "Choose Requester, IT Staff, or Administrator.";
  }

  const passwordLength = passwordCodePointLength(values.initialPassword);
  if (passwordLength < 15 || passwordLength > 128) {
    errors.initialPassword =
      "Initial password must contain 15–128 Unicode characters.";
  }

  return errors;
};

export const getUserFieldErrors = (error: unknown): UserFieldErrors => {
  if (!(error instanceof ApiRequestError) || error.details === undefined) {
    return {};
  }

  const errors: UserFieldErrors = {};
  const { fields } = error.details;

  if (typeof fields === "object" && fields !== null && !Array.isArray(fields)) {
    for (const [field, message] of Object.entries(fields)) {
      if (isUserField(field) && typeof message === "string") {
        errors[field] = message;
      }
    }
  }

  const { field, reason } = error.details;
  if (
    Object.keys(errors).length === 0 &&
    typeof field === "string" &&
    isUserField(field) &&
    typeof reason === "string"
  ) {
    errors[field] = reason;
  }

  return errors;
};
