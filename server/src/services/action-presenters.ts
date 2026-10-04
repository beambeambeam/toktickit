import type {
  ActionEventType as PrismaActionEventType,
  ActionStatus as PrismaActionStatus,
} from "../generated/prisma/enums.js";
import type { ActionStatus } from "../types/actions.js";
import type { UserRoleValue } from "../types/users.js";
import { toUserRoleLabel } from "../types/users.js";

export interface ActionUserRecord {
  displayName: string;
  id: number;
  isActive: boolean;
  role: UserRoleValue;
}

export interface ActionUserRefRecord {
  displayName: string;
  id: number;
  role: UserRoleValue;
}

export interface ActionEventRecord {
  actionId: number;
  actionVersion: number;
  actor: ActionUserRefRecord;
  createdAt: Date;
  eventType: PrismaActionEventType;
  fromStatus: PrismaActionStatus | null;
  id: number;
  snapshot: unknown;
  toStatus: PrismaActionStatus | null;
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

const actionStatusFromLabel = (value: unknown): value is ActionStatus =>
  value === "Planned" ||
  value === "In Progress" ||
  value === "Completed" ||
  value === "Cancelled";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toActionEventSnapshot = (value: unknown) => {
  if (!isRecord(value)) {
    return null;
  }

  const {
    assigneeId,
    attachmentNotes,
    description,
    followUpNote,
    followUpRequired,
    result,
    status,
  } = value;

  if (
    typeof description !== "string" ||
    (typeof result !== "string" && result !== null) ||
    typeof assigneeId !== "number" ||
    !Number.isSafeInteger(assigneeId) ||
    assigneeId <= 0 ||
    typeof followUpRequired !== "boolean" ||
    (typeof followUpNote !== "string" && followUpNote !== null) ||
    (typeof attachmentNotes !== "string" && attachmentNotes !== null) ||
    !actionStatusFromLabel(status)
  ) {
    return null;
  }

  return {
    assigneeId,
    attachmentNotes,
    description,
    followUpNote,
    followUpRequired,
    result,
    status,
  };
};

const toUserRef = (user: ActionUserRefRecord | null) =>
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

export const toActionEvent = (event: ActionEventRecord) => ({
  actionId: event.actionId,
  actionVersion: event.actionVersion,
  actor: toUserRef(event.actor),
  createdAt: event.createdAt.toISOString(),
  eventType: event.eventType,
  fromStatus:
    event.fromStatus === null ? null : actionStatusLabels[event.fromStatus],
  id: event.id,
  snapshot: toActionEventSnapshot(event.snapshot),
  toStatus: event.toStatus === null ? null : actionStatusLabels[event.toStatus],
});
