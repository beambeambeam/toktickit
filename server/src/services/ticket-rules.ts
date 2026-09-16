import path from "node:path";

import { ApiError } from "../errors/api-error.js";
import { statusRequiresConfirmation } from "../types/ticket-workflow.js";
import type {
  CurrentStatus,
  ItPriorityMutationInput,
  OwnerMutationInput,
  RequestedPriority,
  StatusMutationInput,
  TicketFields,
  TicketListQuery,
  StaffTicketListQuery,
  StaffTicketOwnerFilter,
  StaffTicketSortField,
  TicketSortDirection,
  TicketSortField,
  TicketVersionInput,
} from "../types/tickets.js";

export type {
  CurrentStatus,
  RequestedPriority,
  StaffTicketListQuery,
  StaffTicketOwnerFilter,
  StaffTicketSortField,
  TicketFields,
  TicketListQuery,
  TicketSortDirection,
  TicketSortField,
} from "../types/tickets.js";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ACTIVE_ATTACHMENTS = 5;
export const MIN_SUMMARY_LENGTH = 5;
export const MAX_SUMMARY_LENGTH = 120;
export const MIN_DESCRIPTION_LENGTH = 20;
export const MAX_DESCRIPTION_LENGTH = 4000;

export const requestedPriorities = ["Low", "Medium", "High", "Urgent"] as const;
export const currentStatuses = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
] as const;
export const ticketSortFields = [
  "ticketNumber",
  "ticketDate",
  "summary",
  "requestedPriority",
  "currentStatus",
  "updatedAt",
] as const;

export const staffTicketSortFields = [
  "ticketDate",
  "updatedAt",
  "itPriority",
  "ticketNumber",
] as const;

export interface AttachmentCandidate {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ValidatedAttachment {
  buffer: Buffer;
  byteSize: number;
  mediaType: string;
  originalFilename: string;
}

interface ValidationIssue {
  field: string;
  reason: string;
}

const createValidationError = (issues: readonly ValidationIssue[]) => {
  const [firstIssue] = issues;

  if (firstIssue === undefined) {
    return new ApiError(400, "VALIDATION_ERROR", "Request validation failed.");
  }

  return new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
    field: firstIssue.field,
    fields: Object.fromEntries(
      issues.map((issue) => [issue.field, issue.reason])
    ),
    reason: firstIssue.reason,
  });
};

const getSingleValue = (
  input: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[]
): string | undefined => {
  const value = input[field];

  if (typeof value !== "string") {
    issues.push({ field, reason: `${field} is required.` });
    return undefined;
  }

  return value;
};

const getOptionalSingleValue = (
  input: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[]
): string | undefined => {
  const value = input[field];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    issues.push({ field, reason: `${field} must be a single value.` });
    return undefined;
  }

  return value;
};

const MAX_POSTGRES_INT = 2_147_483_647;

const parsePositiveInteger = (
  value: string | undefined,
  field: string,
  issues: ValidationIssue[],
  maximum = Number.MAX_SAFE_INTEGER
): number | undefined => {
  if (value === undefined || !/^[1-9]\d*$/u.test(value)) {
    issues.push({ field, reason: `${field} must be a positive integer.` });
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    issues.push({ field, reason: `${field} must be a positive integer.` });
    return undefined;
  }

  return parsed;
};

const parseOptionalPositiveInteger = (
  value: string | undefined,
  field: string,
  issues: ValidationIssue[],
  maximum = Number.MAX_SAFE_INTEGER
): number | undefined =>
  value === undefined
    ? undefined
    : parsePositiveInteger(value, field, issues, maximum);

const parsePageSize = (
  value: string,
  issues: ValidationIssue[]
): 10 | 25 | 50 | undefined => {
  if (value === "10") {
    return 10;
  }

  if (value === "25") {
    return 25;
  }

  if (value === "50") {
    return 50;
  }

  issues.push({
    field: "pageSize",
    reason: "Page size must be 10, 25, or 50.",
  });
  return undefined;
};

const isRequestedPriority = (value: string): value is RequestedPriority =>
  requestedPriorities.some((priority) => priority === value);

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

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= MAX_POSTGRES_INT;

const parseVersion = (value: unknown): number => {
  if (!isPositiveSafeInteger(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "version",
      reason: "Version must be a positive integer.",
    });
  }

  return value;
};

export const validateClaimInput = (body: unknown): TicketVersionInput => {
  if (!isExactObject(body, ["version"])) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "body",
      reason: "Version is required.",
    });
  }

  return { version: parseVersion(body.version) };
};

export const validateOwnerMutation = (body: unknown): OwnerMutationInput => {
  if (!isExactObject(body, ["ownerId", "version"])) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "body",
      reason: "Owner ID and version are required; owner ID may be null.",
    });
  }

  const { ownerId } = body;
  if (ownerId !== null && !isPositiveSafeInteger(ownerId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "ownerId",
      reason: "Owner ID must be a positive integer or null.",
    });
  }

  return { ownerId, version: parseVersion(body.version) };
};

export const validateItPriorityMutation = (
  body: unknown
): ItPriorityMutationInput => {
  if (!isExactObject(body, ["itPriority", "version"])) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "body",
      reason: "IT Priority and version are required.",
    });
  }

  const { itPriority, version } = body;
  if (typeof itPriority !== "string" || !isRequestedPriority(itPriority)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "itPriority",
      reason: "IT Priority must be Low, Medium, High, or Urgent.",
    });
  }

  return { itPriority, version: parseVersion(version) };
};

const isCurrentStatus = (value: string): value is CurrentStatus =>
  currentStatuses.some((status) => status === value);

export const validateStatusMutation = (body: unknown): StatusMutationInput => {
  if (!isRecord(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "body",
      reason: "Current Status and version are required.",
    });
  }

  const keys = Object.keys(body);
  if (
    keys.length < 2 ||
    keys.length > 3 ||
    !keys.includes("currentStatus") ||
    !keys.includes("version") ||
    keys.some(
      (field) => !["confirmed", "currentStatus", "version"].includes(field)
    )
  ) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "body",
      reason: "Current Status and version are required.",
    });
  }

  const { confirmed, currentStatus, version } = body;

  if (typeof currentStatus !== "string" || !isCurrentStatus(currentStatus)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "currentStatus",
      reason: "Current Status is invalid.",
    });
  }

  if (confirmed !== undefined && typeof confirmed !== "boolean") {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "confirmed",
      reason: "confirmed must be a boolean.",
    });
  }

  if (statusRequiresConfirmation(currentStatus) && confirmed !== true) {
    throw new ApiError(
      400,
      "CONFIRMATION_REQUIRED",
      "Confirm this terminal Ticket transition before continuing.",
      { field: "confirmed", reason: "Set confirmed to true." }
    );
  }

  const parsedVersion = parseVersion(version);
  return confirmed === undefined
    ? { currentStatus, version: parsedVersion }
    : { confirmed, currentStatus, version: parsedVersion };
};

export const validateEmptyRequest = (body: unknown): void => {
  if (!isRecord(body) || Object.keys(body).length !== 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "body",
      reason: "Request body must be empty.",
    });
  }
};

const isTicketSortField = (value: string): value is TicketSortField =>
  ticketSortFields.some((field) => field === value);

const isTicketSortDirection = (value: string): value is TicketSortDirection =>
  value === "asc" || value === "desc";

const isStaffTicketSortField = (value: string): value is StaffTicketSortField =>
  staffTicketSortFields.some((field) => field === value);

const isStaffTicketOwnerFilter = (
  value: string
): value is Exclude<StaffTicketOwnerFilter, number> =>
  value === "me" || value === "unassigned";

const parseOptionalEnum = <T extends string>(
  value: string | undefined,
  field: string,
  isValue: (candidate: string) => candidate is T,
  reason: string,
  issues: ValidationIssue[]
): T | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!isValue(value)) {
    issues.push({ field, reason });
    return undefined;
  }

  return value;
};

export const validateTicketFields = (
  input: Record<string, unknown>
): TicketFields => {
  const issues: ValidationIssue[] = [];
  const allowedFields = new Set([
    "categoryId",
    "description",
    "relatedSystemId",
    "requestedPriority",
    "summary",
  ]);

  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      issues.push({
        field,
        reason: "Request field is not supported.",
      });
    }
  }

  const categoryId = parsePositiveInteger(
    getSingleValue(input, "categoryId", issues),
    "categoryId",
    issues,
    MAX_POSTGRES_INT
  );
  const relatedSystemId = parsePositiveInteger(
    getSingleValue(input, "relatedSystemId", issues),
    "relatedSystemId",
    issues,
    MAX_POSTGRES_INT
  );
  const summaryValue = getSingleValue(input, "summary", issues);
  const descriptionValue = getSingleValue(input, "description", issues);
  const priorityValue = getSingleValue(input, "requestedPriority", issues);
  const summary = summaryValue?.trim();
  const description = descriptionValue?.trim();

  if (
    summary !== undefined &&
    (summary.length < MIN_SUMMARY_LENGTH || summary.length > MAX_SUMMARY_LENGTH)
  ) {
    issues.push({
      field: "summary",
      reason: `Summary must contain ${MIN_SUMMARY_LENGTH}–${MAX_SUMMARY_LENGTH} characters after trimming.`,
    });
  }

  if (
    description !== undefined &&
    (description.length < MIN_DESCRIPTION_LENGTH ||
      description.length > MAX_DESCRIPTION_LENGTH)
  ) {
    issues.push({
      field: "description",
      reason: `Description must contain ${MIN_DESCRIPTION_LENGTH}–${MAX_DESCRIPTION_LENGTH} characters after trimming.`,
    });
  }

  if (priorityValue !== undefined && !isRequestedPriority(priorityValue)) {
    issues.push({
      field: "requestedPriority",
      reason: "Requested priority must be Low, Medium, High, or Urgent.",
    });
  }

  if (
    issues.length > 0 ||
    categoryId === undefined ||
    relatedSystemId === undefined ||
    summary === undefined ||
    description === undefined ||
    priorityValue === undefined ||
    !isRequestedPriority(priorityValue)
  ) {
    throw createValidationError(issues);
  }

  return {
    categoryId,
    description,
    relatedSystemId,
    requestedPriority: priorityValue,
    summary,
  };
};

export const validateRemovalReason = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "reason",
      reason: "A removal reason is required.",
    });
  }

  const reason = value.trim();

  if (reason.length < 3 || reason.length > 500) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "reason",
      reason: "Removal reason must contain 3–500 characters after trimming.",
    });
  }

  return reason;
};

const allowedQueryFields = new Set([
  "categoryId",
  "currentStatus",
  "page",
  "pageSize",
  "relatedSystemId",
  "requestedPriority",
  "search",
  "sortBy",
  "sortDirection",
]);

const appendUnsupportedQueryIssues = (
  input: Record<string, unknown>,
  issues: ValidationIssue[]
) => {
  for (const field of Object.keys(input)) {
    if (!allowedQueryFields.has(field)) {
      issues.push({ field, reason: "Query parameter is not supported." });
    }
  }
};

export const parseTicketListQuery = (
  input: Record<string, unknown>
): TicketListQuery => {
  const issues: ValidationIssue[] = [];
  appendUnsupportedQueryIssues(input, issues);

  const categoryId = parseOptionalPositiveInteger(
    getOptionalSingleValue(input, "categoryId", issues),
    "categoryId",
    issues,
    MAX_POSTGRES_INT
  );
  const relatedSystemId = parseOptionalPositiveInteger(
    getOptionalSingleValue(input, "relatedSystemId", issues),
    "relatedSystemId",
    issues,
    MAX_POSTGRES_INT
  );
  const pageValue = getOptionalSingleValue(input, "page", issues);
  const pageSizeValue = getOptionalSingleValue(input, "pageSize", issues);
  const page =
    pageValue === undefined
      ? 1
      : parsePositiveInteger(pageValue, "page", issues, MAX_POSTGRES_INT);
  const pageSize =
    pageSizeValue === undefined ? 10 : parsePageSize(pageSizeValue, issues);
  const requestedPriority = parseOptionalEnum(
    getOptionalSingleValue(input, "requestedPriority", issues),
    "requestedPriority",
    isRequestedPriority,
    "Requested priority must be Low, Medium, High, or Urgent.",
    issues
  );
  const currentStatus = parseOptionalEnum(
    getOptionalSingleValue(input, "currentStatus", issues),
    "currentStatus",
    isCurrentStatus,
    "Current status is not supported.",
    issues
  );
  const sortBy = parseOptionalEnum(
    getOptionalSingleValue(input, "sortBy", issues),
    "sortBy",
    isTicketSortField,
    "Sort field is not supported.",
    issues
  );
  const sortDirection = parseOptionalEnum(
    getOptionalSingleValue(input, "sortDirection", issues),
    "sortDirection",
    isTicketSortDirection,
    "Sort direction must be asc or desc.",
    issues
  );
  const searchValue = getOptionalSingleValue(input, "search", issues);
  const normalizedSearch = searchValue?.trim();

  if (normalizedSearch !== undefined && normalizedSearch.length > 200) {
    issues.push({
      field: "search",
      reason: "Search must contain at most 200 characters.",
    });
  }

  if (issues.length > 0 || page === undefined || pageSize === undefined) {
    throw createValidationError(issues);
  }

  const query: TicketListQuery = {
    page,
    pageSize,
    sortBy: sortBy ?? "updatedAt",
    sortDirection: sortDirection ?? "desc",
  };

  if (categoryId !== undefined) {
    query.categoryId = categoryId;
  }

  if (currentStatus !== undefined) {
    query.currentStatus = currentStatus;
  }

  if (normalizedSearch !== undefined && normalizedSearch.length > 0) {
    query.search = normalizedSearch;
  }

  if (relatedSystemId !== undefined) {
    query.relatedSystemId = relatedSystemId;
  }

  if (requestedPriority !== undefined) {
    query.requestedPriority = requestedPriority;
  }

  return query;
};

const staffAllowedQueryFields = new Set([
  "categoryId",
  "currentStatus",
  "itPriority",
  "owner",
  "page",
  "pageSize",
  "relatedSystemId",
  "requestedPriority",
  "search",
  "sortBy",
  "sortDirection",
]);

const parseStaffPageSize = (
  value: string,
  issues: ValidationIssue[]
): 10 | 20 | 50 | undefined => {
  if (value === "10") {
    return 10;
  }

  if (value === "20") {
    return 20;
  }

  if (value === "50") {
    return 50;
  }

  issues.push({
    field: "pageSize",
    reason: "Page size must be 10, 20, or 50.",
  });
  return undefined;
};

const appendStaffUnsupportedQueryIssues = (
  input: Record<string, unknown>,
  issues: ValidationIssue[]
) => {
  for (const field of Object.keys(input)) {
    if (!staffAllowedQueryFields.has(field)) {
      issues.push({ field, reason: "Query parameter is not supported." });
    }
  }
};

// oxlint-disable-next-line complexity -- this parser validates the complete documented queue contract.
export const parseStaffTicketListQuery = (
  input: Record<string, unknown>
): StaffTicketListQuery => {
  const issues: ValidationIssue[] = [];
  appendStaffUnsupportedQueryIssues(input, issues);

  const categoryId = parseOptionalPositiveInteger(
    getOptionalSingleValue(input, "categoryId", issues),
    "categoryId",
    issues,
    MAX_POSTGRES_INT
  );
  const currentStatus = parseOptionalEnum(
    getOptionalSingleValue(input, "currentStatus", issues),
    "currentStatus",
    isCurrentStatus,
    "Current status is not supported.",
    issues
  );
  const itPriority = parseOptionalEnum(
    getOptionalSingleValue(input, "itPriority", issues),
    "itPriority",
    isRequestedPriority,
    "IT priority must be Low, Medium, High, or Urgent.",
    issues
  );
  const ownerValue = getOptionalSingleValue(input, "owner", issues);
  let owner: StaffTicketOwnerFilter | undefined;

  if (ownerValue !== undefined) {
    owner = isStaffTicketOwnerFilter(ownerValue)
      ? ownerValue
      : parsePositiveInteger(ownerValue, "owner", issues, MAX_POSTGRES_INT);
  }

  const pageValue = getOptionalSingleValue(input, "page", issues);
  const page =
    pageValue === undefined
      ? 1
      : parsePositiveInteger(pageValue, "page", issues, MAX_POSTGRES_INT);
  const pageSizeValue = getOptionalSingleValue(input, "pageSize", issues);
  const pageSize =
    pageSizeValue === undefined
      ? 20
      : parseStaffPageSize(pageSizeValue, issues);
  const relatedSystemId = parseOptionalPositiveInteger(
    getOptionalSingleValue(input, "relatedSystemId", issues),
    "relatedSystemId",
    issues,
    MAX_POSTGRES_INT
  );
  const requestedPriority = parseOptionalEnum(
    getOptionalSingleValue(input, "requestedPriority", issues),
    "requestedPriority",
    isRequestedPriority,
    "Requested priority must be Low, Medium, High, or Urgent.",
    issues
  );
  const searchValue = getOptionalSingleValue(input, "search", issues);
  const normalizedSearch = searchValue?.trim();
  if (normalizedSearch !== undefined && normalizedSearch.length > 200) {
    issues.push({
      field: "search",
      reason: "Search must contain at most 200 characters.",
    });
  }
  const sortBy = parseOptionalEnum(
    getOptionalSingleValue(input, "sortBy", issues),
    "sortBy",
    isStaffTicketSortField,
    "Queue sort field is not supported.",
    issues
  );
  const sortDirection = parseOptionalEnum(
    getOptionalSingleValue(input, "sortDirection", issues),
    "sortDirection",
    isTicketSortDirection,
    "Sort direction must be asc or desc.",
    issues
  );

  if (issues.length > 0 || page === undefined || pageSize === undefined) {
    throw createValidationError(issues);
  }

  const query: StaffTicketListQuery = {
    page,
    pageSize,
    sortBy: sortBy ?? "updatedAt",
    sortDirection: sortDirection ?? "desc",
  };

  if (categoryId !== undefined) {
    query.categoryId = categoryId;
  }

  if (currentStatus !== undefined) {
    query.currentStatus = currentStatus;
  }

  if (itPriority !== undefined) {
    query.itPriority = itPriority;
  }

  if (normalizedSearch !== undefined && normalizedSearch.length > 0) {
    query.search = normalizedSearch;
  }

  if (owner !== undefined) {
    query.owner = owner;
  }

  if (relatedSystemId !== undefined) {
    query.relatedSystemId = relatedSystemId;
  }

  if (requestedPriority !== undefined) {
    query.requestedPriority = requestedPriority;
  }

  return query;
};

type AllowedMediaType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

const allowedAttachmentTypes: Record<AllowedMediaType, readonly string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpeg", ".jpg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const isAllowedMediaType = (value: string): value is AllowedMediaType =>
  value === "application/pdf" ||
  value === "image/jpeg" ||
  value === "image/png" ||
  value === "image/webp";

const hasPrefix = (buffer: Buffer, prefix: readonly number[]): boolean =>
  prefix.every((byte, index) => buffer[index] === byte);

const hasAttachmentSignature = (
  buffer: Buffer,
  mediaType: AllowedMediaType
) => {
  if (mediaType === "application/pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if (mediaType === "image/jpeg") {
    return hasPrefix(buffer, [0xff, 0xd8, 0xff]);
  }

  if (mediaType === "image/png") {
    return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
};

const sanitizeFilenameCharacters = (filename: string): string =>
  Array.from(filename, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 0x20 || codePoint === 0x7f || /[<>:&"']/u.test(character)
      ? "_"
      : character;
  }).join("");

export const normalizeAttachmentFilename = (filename: string): string => {
  const basename = path.basename(filename.replaceAll("\\", "/"));
  const normalized = sanitizeFilenameCharacters(basename)
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 255);

  return normalized.length > 0 && !/^\.+$/u.test(normalized)
    ? normalized
    : "attachment";
};

export const validateAttachmentFiles = (
  files: readonly AttachmentCandidate[],
  existingActiveCount = 0
): ValidatedAttachment[] => {
  if (
    existingActiveCount < 0 ||
    existingActiveCount + files.length > MAX_ACTIVE_ATTACHMENTS
  ) {
    throw new ApiError(
      409,
      "ATTACHMENT_LIMIT_EXCEEDED",
      "Attachment limit exceeded."
    );
  }

  const validated: ValidatedAttachment[] = [];

  for (const [index, file] of files.entries()) {
    const mediaType = file.mimetype.toLowerCase();
    const extension = path.extname(file.originalname).toLowerCase();
    const extensions = isAllowedMediaType(mediaType)
      ? allowedAttachmentTypes[mediaType]
      : undefined;

    if (extensions === undefined || !extensions.includes(extension)) {
      throw new ApiError(
        415,
        "UNSUPPORTED_ATTACHMENT_TYPE",
        "Attachment type is not supported.",
        {
          field: `attachments[${index}]`,
          reason: "Use JPG, JPEG, PNG, WEBP, or PDF.",
        }
      );
    }

    const byteSize = file.buffer.byteLength;

    if (file.size > MAX_ATTACHMENT_BYTES || byteSize > MAX_ATTACHMENT_BYTES) {
      throw new ApiError(
        413,
        "ATTACHMENT_TOO_LARGE",
        "Attachment exceeds the 5 MB limit.",
        {
          field: `attachments[${index}]`,
          reason: "Each attachment must be at most 5 MB.",
        }
      );
    }

    if (
      !isAllowedMediaType(mediaType) ||
      !hasAttachmentSignature(file.buffer, mediaType)
    ) {
      throw new ApiError(
        400,
        "INVALID_ATTACHMENT",
        "Attachment content does not match its declared type.",
        {
          field: `attachments[${index}]`,
          reason: "The file signature is invalid.",
        }
      );
    }

    validated.push({
      buffer: file.buffer,
      byteSize,
      mediaType,
      originalFilename: normalizeAttachmentFilename(file.originalname),
    });
  }

  return validated;
};
