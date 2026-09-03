import { ApiRequestError } from "@/api/requester";
import { isRequestedPriority } from "@/lib/ticket-priorities";

export { isRequestedPriority } from "@/lib/ticket-priorities";
export type { RequestedPriority } from "@/lib/ticket-priorities";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ACTIVE_ATTACHMENTS = 5;
export const MIN_SUMMARY_LENGTH = 5;
export const MAX_SUMMARY_LENGTH = 120;
export const MIN_DESCRIPTION_LENGTH = 20;
export const MAX_DESCRIPTION_LENGTH = 4000;

export interface TicketFormValues {
  categoryId: string;
  description: string;
  relatedSystemId: string;
  requestedPriority: string;
  summary: string;
}

export type TicketFieldErrors = Partial<Record<keyof TicketFormValues, string>>;

const attachmentTypes = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
} as const;

type AttachmentMediaType = keyof typeof attachmentTypes;

const isAttachmentMediaType = (value: string): value is AttachmentMediaType =>
  value in attachmentTypes;

const isTicketFormField = (field: string): field is keyof TicketFormValues =>
  field === "categoryId" ||
  field === "description" ||
  field === "relatedSystemId" ||
  field === "requestedPriority" ||
  field === "summary";

export const validateTicketForm = (
  values: TicketFormValues
): TicketFieldErrors => {
  const errors: TicketFieldErrors = {};

  if (!values.categoryId) {
    errors.categoryId = "Choose a Category.";
  }

  if (!values.relatedSystemId) {
    errors.relatedSystemId = "Choose a Related System.";
  }

  const summary = values.summary.trim();
  if (
    summary.length < MIN_SUMMARY_LENGTH ||
    summary.length > MAX_SUMMARY_LENGTH
  ) {
    errors.summary = `Summary must contain ${MIN_SUMMARY_LENGTH}–${MAX_SUMMARY_LENGTH} characters after trimming.`;
  }

  if (!isRequestedPriority(values.requestedPriority)) {
    errors.requestedPriority = "Choose Low, Medium, High, or Urgent.";
  }

  const description = values.description.trim();
  if (
    description.length < MIN_DESCRIPTION_LENGTH ||
    description.length > MAX_DESCRIPTION_LENGTH
  ) {
    errors.description = `Description must contain ${MIN_DESCRIPTION_LENGTH}–${MAX_DESCRIPTION_LENGTH} characters after trimming.`;
  }

  return errors;
};

export const validateSelectedFiles = (files: readonly File[]) => {
  const errors: string[] = [];
  const validFiles: File[] = [];

  if (files.length > MAX_ACTIVE_ATTACHMENTS) {
    errors.push("Choose no more than five attachments.");
  }

  for (const file of files.slice(0, MAX_ACTIVE_ATTACHMENTS)) {
    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    const allowedExtensions = isAttachmentMediaType(file.type)
      ? attachmentTypes[file.type]
      : undefined;
    const hasAllowedType =
      allowedExtensions?.some(
        (allowedExtension) => allowedExtension === extension
      ) ?? false;

    if (!hasAllowedType) {
      errors.push(`${file.name}: use JPG, JPEG, PNG, WEBP, or PDF.`);
      continue;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      errors.push(`${file.name}: each attachment must be at most 5 MB.`);
      continue;
    }

    validFiles.push(file);
  }

  return { errors, validFiles };
};

export const getApiFieldErrors = (error: unknown): TicketFieldErrors => {
  if (!(error instanceof ApiRequestError) || error.details === undefined) {
    return {};
  }

  const fieldErrors: TicketFieldErrors = {};
  const { fields } = error.details;

  if (typeof fields === "object" && fields !== null && !Array.isArray(fields)) {
    for (const [field, message] of Object.entries(fields)) {
      if (isTicketFormField(field) && typeof message === "string") {
        fieldErrors[field] = message;
      }
    }
  }

  if (
    Object.keys(fieldErrors).length === 0 &&
    typeof error.details.field === "string" &&
    typeof error.details.reason === "string" &&
    isTicketFormField(error.details.field)
  ) {
    fieldErrors[error.details.field] = error.details.reason;
  }

  return fieldErrors;
};
