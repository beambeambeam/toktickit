import type { CurrentStatus } from "@/generated/hey-api/types.gen";

export { type CurrentStatus } from "@/generated/hey-api/types.gen";

export const currentStatuses: readonly CurrentStatus[] = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
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

export const isTerminalStatus = (status: CurrentStatus): boolean =>
  status === "Resolved" || status === "Closed" || status === "Cancelled";

export const isCurrentStatus = (value: unknown): value is CurrentStatus =>
  typeof value === "string" &&
  currentStatuses.some((status) => status === value);
