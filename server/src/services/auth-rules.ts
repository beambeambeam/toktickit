import { ApiError } from "../errors/api-error.js";

export const MIN_PASSWORD_CODE_POINTS = 15;
export const MAX_PASSWORD_CODE_POINTS = 128;
export const MAX_EMAIL_LENGTH = 254;

export const passwordLengthInCodePoints = (password: string): number =>
  // oxlint-disable-next-line unicorn/prefer-spread -- auth contract counts Unicode code points, not grapheme clusters.
  Array.from(password).length;

export const isValidPasswordLength = (password: string): boolean => {
  const length = passwordLengthInCodePoints(password);
  return (
    length >= MIN_PASSWORD_CODE_POINTS && length <= MAX_PASSWORD_CODE_POINTS
  );
};

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

export const isValidEmail = (email: string): boolean =>
  email.length <= MAX_EMAIL_LENGTH &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(email);

export const validateEmail = (value: unknown, field = "email"): string => {
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field,
      reason: "Email is required.",
    });
  }

  const email = normalizeEmail(value);

  if (!isValidEmail(email)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field,
      reason: "Enter a valid email address.",
    });
  }

  return email;
};

export const validatePassword = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !isValidPasswordLength(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field,
      reason: `Password must contain ${MIN_PASSWORD_CODE_POINTS}–${MAX_PASSWORD_CODE_POINTS} Unicode characters.`,
    });
  }

  return value;
};
