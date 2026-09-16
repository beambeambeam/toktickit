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
