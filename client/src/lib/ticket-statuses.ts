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

export const isCurrentStatus = (value: unknown): value is CurrentStatus =>
  typeof value === "string" &&
  currentStatuses.some((status) => status === value);
