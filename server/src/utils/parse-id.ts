import { ApiError } from "../errors/api-error.js";

export const parsePositiveId = (value: unknown, field: string): number => {
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field,
      reason: `${field} must be a positive integer.`,
    });
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 2_147_483_647) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field,
      reason: `${field} must be a positive integer.`,
    });
  }

  return id;
};
