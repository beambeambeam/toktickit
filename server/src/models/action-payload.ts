import { createHash } from "node:crypto";

import type { CreateActionInput } from "../types/actions.js";

type ActionBusinessFields = Pick<
  CreateActionInput,
  | "attachmentNotes"
  | "description"
  | "followUpNote"
  | "followUpRequired"
  | "result"
>;

export type ActionPayload = ActionBusinessFields & { assigneeId: number };

export const getActionPayload = (
  input: ActionBusinessFields,
  assigneeId: number
): ActionPayload => ({
  assigneeId,
  attachmentNotes: input.attachmentNotes,
  description: input.description,
  followUpNote: input.followUpNote,
  followUpRequired: input.followUpRequired,
  result: input.result,
});

export const hashActionPayload = (payload: ActionPayload): string =>
  createHash("sha256")
    .update(JSON.stringify(getActionPayload(payload, payload.assigneeId)))
    .digest("hex");

export const createActionSnapshot = (payload: ActionPayload) => ({
  ...payload,
  status: "Planned" as const,
});
