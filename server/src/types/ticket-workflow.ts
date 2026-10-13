import type {
  CurrentStatus as PrismaCurrentStatus,
  UserRole as PrismaUserRole,
} from "../generated/prisma/enums.js";
import type { CurrentStatus } from "./tickets.js";

export const currentStatusToPrisma: Record<CurrentStatus, PrismaCurrentStatus> =
  {
    Cancelled: "Cancelled",
    Closed: "Closed",
    "In Progress": "InProgress",
    New: "New",
    Open: "Open",
    Reopened: "Reopened",
    Resolved: "Resolved",
    "Waiting for Requester": "WaitingForRequester",
  };

export const prismaStatusToCurrent: Record<PrismaCurrentStatus, CurrentStatus> =
  {
    Cancelled: "Cancelled",
    Closed: "Closed",
    InProgress: "In Progress",
    New: "New",
    Open: "Open",
    Reopened: "Reopened",
    Resolved: "Resolved",
    WaitingForRequester: "Waiting for Requester",
  };

export const activeTicketStatuses: readonly CurrentStatus[] = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Reopened",
];

export const allowedNextStatuses: Record<
  CurrentStatus,
  readonly CurrentStatus[]
> = {
  Cancelled: [],
  Closed: [],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  New: ["Open", "Cancelled"],
  Open: ["In Progress", "Waiting for Requester", "Cancelled"],
  Reopened: ["Open", "In Progress", "Cancelled"],
  Resolved: ["Closed", "Reopened"],
  "Waiting for Requester": ["In Progress", "Resolved", "Cancelled"],
};

export const isAllowedStatusTransition = (
  currentStatus: CurrentStatus,
  nextStatus: CurrentStatus
): boolean => allowedNextStatuses[currentStatus].includes(nextStatus);

export const statusRequiresEligibleOwner = (status: CurrentStatus): boolean =>
  status === "In Progress" || status === "Resolved";

export const statusRequiresConfirmation = (status: CurrentStatus): boolean =>
  status === "Resolved" || status === "Closed" || status === "Cancelled";

export const terminalStatuses = new Set<CurrentStatus>([
  "Resolved",
  "Closed",
  "Cancelled",
]);

export const isEligibleTicketOwner = (user: {
  isActive: boolean;
  role: PrismaUserRole;
}): boolean =>
  user.isActive && (user.role === "ITStaff" || user.role === "Administrator");

export type ResolutionGateReason =
  | "NO_COMPLETED_ACTION"
  | "OWNER_INELIGIBLE"
  | "OWNER_REQUIRED"
  | "PENDING_ACTIONS";

interface ResolutionGateFacts {
  completedActionCount: number;
  owner: { isActive: boolean; role: PrismaUserRole } | null;
  pendingActionCount: number;
}

export const getResolutionGateReasons = ({
  completedActionCount,
  owner,
  pendingActionCount,
}: ResolutionGateFacts): ResolutionGateReason[] => {
  const reasons: ResolutionGateReason[] = [];

  if (owner === null) {
    reasons.push("OWNER_REQUIRED");
  } else if (!isEligibleTicketOwner(owner)) {
    reasons.push("OWNER_INELIGIBLE");
  }

  if (pendingActionCount > 0) {
    reasons.push("PENDING_ACTIONS");
  }

  if (completedActionCount === 0) {
    reasons.push("NO_COMPLETED_ACTION");
  }

  return reasons;
};

export const isCancellationBlockedByActions = (
  pendingActionCount: number
): boolean => pendingActionCount > 0;
