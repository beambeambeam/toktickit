import { createHash } from "node:crypto";

import type { ActionStatus, CreateActionInput } from "../types/actions.js";

type ActionBusinessFields = Pick<
  CreateActionInput,
  | "attachmentNotes"
  | "description"
  | "followUpNote"
  | "followUpRequired"
  | "result"
>;

export type ActionPayload = ActionBusinessFields & { assigneeId: number };

// Insertion order defines the canonical JSON used by the API payload hash.
// oxlint-disable sort-keys -- The API contract fixes this JSON field order.
export const getActionPayload = (
  input: ActionBusinessFields,
  assigneeId: number
): ActionPayload => ({
  description: input.description,
  result: input.result,
  assigneeId,
  followUpRequired: input.followUpRequired,
  followUpNote: input.followUpNote,
  attachmentNotes: input.attachmentNotes,
});
// oxlint-enable sort-keys

export const hashActionPayload = (payload: ActionPayload): string =>
  createHash("sha256")
    .update(JSON.stringify(getActionPayload(payload, payload.assigneeId)))
    .digest("hex");

export const createActionSnapshot = (
  payload: ActionPayload,
  status: ActionStatus = "Planned"
) => ({
  ...payload,
  status,
});
