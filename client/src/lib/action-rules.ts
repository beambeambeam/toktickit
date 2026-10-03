import { ApiRequestError } from "@/api/errors";

export const MAX_ACTION_DESCRIPTION_LENGTH = 5000;
export const MAX_ACTION_RESULT_LENGTH = 5000;
export const MAX_ACTION_FOLLOW_UP_NOTE_LENGTH = 5000;
export const MAX_ACTION_ATTACHMENT_NOTES_LENGTH = 2000;

export interface ActionFormValues {
  assigneeId: string;
  attachmentNotes: string;
  description: string;
  followUpNote: string;
  followUpRequired: boolean;
  result: string;
}

export interface NormalizedActionForm {
  assigneeId: number | undefined;
  attachmentNotes: string | null;
  description: string;
  followUpNote: string | null;
  followUpRequired: boolean;
  result: string | null;
}

export type ActionFieldErrors = Partial<Record<keyof ActionFormValues, string>>;

const codePointLength = (value: string): number =>
  // oxlint-disable-next-line unicorn/prefer-spread -- the API contract counts Unicode code points.
  Array.from(value).length;

const trimmed = (value: string): string => value.trim();

const nullableText = (value: string): string | null => {
  const normalized = trimmed(value);
  return normalized.length === 0 ? null : normalized;
};

const parseAssigneeId = (value: string): number | undefined => {
  if (!/^[1-9]\d*$/u.test(value)) {
    return undefined;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
};

export const normalizeActionForm = (
  values: ActionFormValues
): NormalizedActionForm => ({
  assigneeId: parseAssigneeId(values.assigneeId),
  attachmentNotes: nullableText(values.attachmentNotes),
  description: trimmed(values.description),
  followUpNote: values.followUpRequired
    ? nullableText(values.followUpNote)
    : null,
  followUpRequired: values.followUpRequired,
  result: nullableText(values.result),
});

export const validateActionForm = (
  values: ActionFormValues
): ActionFieldErrors => {
  const errors: ActionFieldErrors = {};
  const description = trimmed(values.description);
  const result = trimmed(values.result);
  const followUpNote = trimmed(values.followUpNote);
  const attachmentNotes = trimmed(values.attachmentNotes);

  if (
    codePointLength(description) < 1 ||
    codePointLength(description) > MAX_ACTION_DESCRIPTION_LENGTH
  ) {
    errors.description =
      "Action Description must contain 1–5,000 Unicode characters after trimming.";
  }

  if (codePointLength(result) > MAX_ACTION_RESULT_LENGTH) {
    errors.result = "Result must contain at most 5,000 Unicode characters.";
  }

  if (values.followUpRequired) {
    if (codePointLength(followUpNote) < 1) {
      errors.followUpNote =
        "Follow-up Note is required when Follow-Up Required is selected.";
    } else if (
      codePointLength(followUpNote) > MAX_ACTION_FOLLOW_UP_NOTE_LENGTH
    ) {
      errors.followUpNote =
        "Follow-up Note must contain 1–5,000 Unicode characters when follow-up is required.";
    }
  }

  if (codePointLength(attachmentNotes) > MAX_ACTION_ATTACHMENT_NOTES_LENGTH) {
    errors.attachmentNotes =
      "Attachment Notes must contain at most 2,000 Unicode characters.";
  }

  return errors;
};

const isActionFormField = (value: string): value is keyof ActionFormValues =>
  value === "description" ||
  value === "result" ||
  value === "assigneeId" ||
  value === "followUpRequired" ||
  value === "followUpNote" ||
  value === "attachmentNotes";

export const getActionFieldErrors = (error: unknown): ActionFieldErrors => {
  if (!(error instanceof ApiRequestError) || error.details === undefined) {
    return {};
  }

  const fieldErrors: ActionFieldErrors = {};
  const { fields } = error.details;

  if (typeof fields === "object" && fields !== null && !Array.isArray(fields)) {
    for (const [field, message] of Object.entries(fields)) {
      if (isActionFormField(field) && typeof message === "string") {
        fieldErrors[field] = message;
      }
    }
  }

  if (
    Object.keys(fieldErrors).length === 0 &&
    typeof error.details.field === "string" &&
    typeof error.details.reason === "string" &&
    isActionFormField(error.details.field)
  ) {
    fieldErrors[error.details.field] = error.details.reason;
  }

  return fieldErrors;
};
