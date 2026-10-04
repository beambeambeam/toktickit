import { ApiError } from "../errors/api-error.js";
import type {
  ActionListPageSize,
  ActionListQuery,
  CreateActionInput,
  EditActionInput,
} from "../types/actions.js";

export const MAX_ACTION_DESCRIPTION_CODE_POINTS = 5000;
export const MAX_ACTION_RESULT_CODE_POINTS = 5000;
export const MAX_ACTION_FOLLOW_UP_NOTE_CODE_POINTS = 5000;
export const MAX_ACTION_ATTACHMENT_NOTES_CODE_POINTS = 2000;

const MAX_POSTGRES_INT = 2_147_483_647;
const actionListPageSizes = [10, 20, 50] as const;
const createActionFields = [
  "requestId",
  "version",
  "description",
  "result",
  "assigneeId",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
] as const;
const editActionFields = [
  "actionVersion",
  "ticketVersion",
  "description",
  "result",
  "assigneeId",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validationError = (field: string, reason: string): ApiError =>
  new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
    field,
    reason,
  });

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= MAX_POSTGRES_INT;

// oxlint-disable-next-line no-misused-spread
const codePointLength = (value: string): number => [...value].length;

const normalizeRequiredText = (
  value: unknown,
  field: string,
  maximum: number
): string => {
  if (typeof value !== "string") {
    throw validationError(field, `${field} is required.`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw validationError(field, `${field} must not be blank.`);
  }

  if (codePointLength(normalized) > maximum) {
    throw validationError(
      field,
      `${field} must contain at most ${maximum} Unicode code points.`
    );
  }

  return normalized;
};

const normalizeOptionalText = (
  value: unknown,
  field: string,
  maximum: number
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw validationError(field, `${field} must be a string or null.`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  if (codePointLength(normalized) > maximum) {
    throw validationError(
      field,
      `${field} must contain at most ${maximum} Unicode code points.`
    );
  }

  return normalized;
};

const validateActionShape = (
  body: unknown,
  allowedFields: readonly string[],
  requiredFields: readonly string[]
): Record<string, unknown> => {
  if (!isRecord(body)) {
    throw validationError("body", "Request body must be an object.");
  }

  const allowedFieldSet = new Set(allowedFields);
  const unsupportedField = Object.keys(body).find(
    (field) => !allowedFieldSet.has(field)
  );

  if (unsupportedField !== undefined) {
    throw validationError(
      unsupportedField,
      `${unsupportedField} is not supported.`
    );
  }

  for (const requiredField of requiredFields) {
    if (!Object.hasOwn(body, requiredField)) {
      throw validationError(requiredField, `${requiredField} is required.`);
    }
  }

  return body;
};

const validateRequestId = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value
    )
  ) {
    throw validationError("requestId", "requestId must be a UUID.");
  }

  return value.toLowerCase();
};

const validateVersion = (value: unknown, field = "version"): number => {
  if (!isPositiveInteger(value)) {
    throw validationError(field, `${field} must be a positive integer.`);
  }

  return value;
};

const validateAssigneeId = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isPositiveInteger(value)) {
    throw validationError(
      "assigneeId",
      "Assignee ID must be a positive integer or null."
    );
  }

  return value;
};

const validateEditableFields = (
  record: Record<string, unknown>
): Pick<
  CreateActionInput,
  | "description"
  | "result"
  | "followUpRequired"
  | "followUpNote"
  | "attachmentNotes"
> => {
  const { followUpRequired } = record;

  if (typeof followUpRequired !== "boolean") {
    throw validationError(
      "followUpRequired",
      "followUpRequired must be a boolean."
    );
  }

  const followUpNote = normalizeOptionalText(
    record.followUpNote,
    "followUpNote",
    MAX_ACTION_FOLLOW_UP_NOTE_CODE_POINTS
  );

  if (followUpRequired && followUpNote === null) {
    throw validationError(
      "followUpNote",
      "followUpNote is required when followUpRequired is true."
    );
  }

  if (!followUpRequired && followUpNote !== null) {
    throw validationError(
      "followUpNote",
      "followUpNote must be blank when followUpRequired is false."
    );
  }

  return {
    attachmentNotes: normalizeOptionalText(
      record.attachmentNotes,
      "attachmentNotes",
      MAX_ACTION_ATTACHMENT_NOTES_CODE_POINTS
    ),
    description: normalizeRequiredText(
      record.description,
      "description",
      MAX_ACTION_DESCRIPTION_CODE_POINTS
    ),
    followUpNote,
    followUpRequired,
    result: normalizeOptionalText(
      record.result,
      "result",
      MAX_ACTION_RESULT_CODE_POINTS
    ),
  };
};

export const validateCreateActionInput = (body: unknown): CreateActionInput => {
  const record = validateActionShape(body, createActionFields, [
    "requestId",
    "version",
    "description",
    "followUpRequired",
  ]);

  return {
    ...validateEditableFields(record),
    assigneeId: validateAssigneeId(record.assigneeId),
    requestId: validateRequestId(record.requestId),
    version: validateVersion(record.version),
  };
};

const validateRequiredId = (value: unknown, field: string): number => {
  if (!isPositiveInteger(value)) {
    throw validationError(field, `${field} must be a positive integer.`);
  }

  return value;
};

export const validateEditActionInput = (body: unknown): EditActionInput => {
  const record = validateActionShape(body, editActionFields, editActionFields);

  return {
    ...validateEditableFields(record),
    actionVersion: validateVersion(record.actionVersion, "actionVersion"),
    assigneeId: validateRequiredId(record.assigneeId, "assigneeId"),
    ticketVersion: validateVersion(record.ticketVersion, "ticketVersion"),
  };
};

const getQueryValue = (
  query: Record<string, unknown>,
  field: string
): string | undefined => {
  const { [field]: value } = query;

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw validationError(field, `${field} must be a single value.`);
  }

  return value;
};

const parsePage = (value: string | undefined): number => {
  if (value === undefined || !/^[1-9]\d*$/u.test(value)) {
    throw validationError("page", "Page must be a positive integer.");
  }

  const page = Number(value);

  if (!Number.isSafeInteger(page) || page > MAX_POSTGRES_INT) {
    throw validationError("page", "Page must be a positive integer.");
  }

  return page;
};

const isActionListPageSize = (value: number): value is ActionListPageSize =>
  actionListPageSizes.some((pageSize) => pageSize === value);

const parsePageSize = (value: string | undefined): ActionListPageSize => {
  if (value === undefined) {
    return 20;
  }

  const pageSize = Number(value);

  if (!/^(?:10|20|50)$/u.test(value) || !isActionListPageSize(pageSize)) {
    throw validationError("pageSize", "Page size must be 10, 20, or 50.");
  }

  return pageSize;
};

export const parseActionListQuery = (query: unknown): ActionListQuery => {
  if (!isRecord(query)) {
    throw validationError("query", "Query must be an object.");
  }

  for (const field of Object.keys(query)) {
    if (field !== "page" && field !== "pageSize") {
      throw validationError(field, `${field} is not supported.`);
    }
  }

  return {
    page: parsePage(getQueryValue(query, "page") ?? "1"),
    pageSize: parsePageSize(getQueryValue(query, "pageSize")),
  };
};
