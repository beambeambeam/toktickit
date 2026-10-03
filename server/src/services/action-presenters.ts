import type { ActionStatus as PrismaActionStatus } from "../generated/prisma/enums.js";
import type { UserRoleValue } from "../types/users.js";
import { toUserRoleLabel } from "../types/users.js";

export interface ActionUserRecord {
  displayName: string;
  id: number;
  isActive: boolean;
  role: UserRoleValue;
}

export interface ActionRecord {
  assignee: ActionUserRecord;
  attachmentNotes: string | null;
  cancelledAt: Date | null;
  cancelledBy: ActionUserRecord | null;
  completedAt: Date | null;
  completedBy: ActionUserRecord | null;
  createdAt: Date;
  createdBy: ActionUserRecord;
  description: string;
  followUpNote: string | null;
  followUpRequired: boolean;
  id: number;
  performedBy: ActionUserRecord | null;
  result: string | null;
  startedAt: Date | null;
  status: PrismaActionStatus;
  ticketId: number;
  updatedAt: Date;
  version: number;
}

const actionStatusLabels: Record<PrismaActionStatus, string> = {
  Cancelled: "Cancelled",
  Completed: "Completed",
  InProgress: "In Progress",
  Planned: "Planned",
};

const toUserRef = (user: ActionUserRecord | null) =>
  user === null
    ? null
    : {
        displayName: user.displayName,
        id: user.id,
        role: toUserRoleLabel(user.role),
      };

const toAssignee = (user: ActionUserRecord) => ({
  displayName: user.displayName,
  id: user.id,
  isActive: user.isActive,
  isEligible:
    user.isActive && (user.role === "ITStaff" || user.role === "Administrator"),
  role: toUserRoleLabel(user.role),
});

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

export const toActionTaken = (action: ActionRecord) => ({
  assignee: toAssignee(action.assignee),
  attachmentNotes: action.attachmentNotes,
  cancelledAt: iso(action.cancelledAt),
  cancelledBy: toUserRef(action.cancelledBy),
  completedAt: iso(action.completedAt),
  completedBy: toUserRef(action.completedBy),
  createdAt: action.createdAt.toISOString(),
  createdBy: toUserRef(action.createdBy),
  description: action.description,
  followUpNote: action.followUpNote,
  followUpRequired: action.followUpRequired,
  id: action.id,
  performedBy: toUserRef(action.performedBy),
  result: action.result,
  startedAt: iso(action.startedAt),
  status: actionStatusLabels[action.status],
  ticketId: action.ticketId,
  updatedAt: action.updatedAt.toISOString(),
  version: action.version,
});
