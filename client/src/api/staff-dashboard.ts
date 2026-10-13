import { apiClient } from "@/api/client";
import { invalidApiResponse, unwrap } from "@/api/errors";
import { getApiStaffDashboard } from "@/generated/hey-api/sdk.gen";
import type {
  ActionStatus,
  MyActionRow,
  Owner,
  StaffDashboardResponse,
  StaffDashboardTicketPreview,
} from "@/generated/hey-api/types.gen";
import { isRequestedPriority } from "@/lib/ticket-priorities";
import { isCurrentStatus } from "@/lib/ticket-statuses";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[]
): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
};

const isUtcIsoString = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isOwnerRole = (value: unknown): value is Owner["role"] =>
  value === "Requester" || value === "IT Staff" || value === "Administrator";

const isOwner = (value: unknown): value is Owner =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.displayName === "string" &&
  isOwnerRole(value.role) &&
  typeof value.isActive === "boolean" &&
  typeof value.isEligible === "boolean";

const isActionStatus = (value: unknown): value is ActionStatus =>
  value === "Planned" ||
  value === "In Progress" ||
  value === "Completed" ||
  value === "Cancelled";

export const isMyActionRow = (value: unknown): value is MyActionRow => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "assignee",
      "description",
      "followUpRequired",
      "id",
      "status",
      "ticket",
      "ticketId",
      "updatedAt",
    ])
  ) {
    return false;
  }

  const { ticket } = value;
  if (
    !isRecord(ticket) ||
    !hasExactKeys(ticket, ["currentStatus", "id", "summary", "ticketNumber"])
  ) {
    return false;
  }

  return (
    isPositiveSafeInteger(value.id) &&
    isPositiveSafeInteger(value.ticketId) &&
    typeof value.description === "string" &&
    typeof value.followUpRequired === "boolean" &&
    isActionStatus(value.status) &&
    isOwner(value.assignee) &&
    isUtcIsoString(value.updatedAt) &&
    isPositiveSafeInteger(ticket.id) &&
    typeof ticket.ticketNumber === "string" &&
    typeof ticket.summary === "string" &&
    isCurrentStatus(ticket.currentStatus)
  );
};

const isStaffDashboardTicketPreview = (
  value: unknown
): value is StaffDashboardTicketPreview => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "currentStatus",
      "id",
      "itPriority",
      "owner",
      "requestedPriority",
      "resolvedAt",
      "summary",
      "ticketNumber",
      "updatedAt",
    ])
  ) {
    return false;
  }

  return (
    isPositiveSafeInteger(value.id) &&
    typeof value.ticketNumber === "string" &&
    typeof value.summary === "string" &&
    isCurrentStatus(value.currentStatus) &&
    isRequestedPriority(value.requestedPriority) &&
    isRequestedPriority(value.itPriority) &&
    (value.owner === null || isOwner(value.owner)) &&
    isUtcIsoString(value.updatedAt) &&
    (value.resolvedAt === null || isUtcIsoString(value.resolvedAt))
  );
};

const hasNonNegativeCounts = (
  value: unknown,
  keys: readonly string[]
): value is Record<string, number> =>
  isRecord(value) &&
  hasExactKeys(value, keys) &&
  Object.values(value).every(isNonNegativeSafeInteger);

const isStaffDashboardCounts = (
  value: unknown
): value is StaffDashboardResponse["counts"] =>
  isRecord(value) &&
  hasExactKeys(value, [
    "activeByPriority",
    "activeOwned",
    "activeUnassigned",
    "byStatus",
    "myActions",
  ]) &&
  isNonNegativeSafeInteger(value.activeUnassigned) &&
  isNonNegativeSafeInteger(value.activeOwned) &&
  isNonNegativeSafeInteger(value.myActions) &&
  hasNonNegativeCounts(value.byStatus, [
    "Cancelled",
    "Closed",
    "In Progress",
    "New",
    "Open",
    "Reopened",
    "Resolved",
    "Waiting for Requester",
  ]) &&
  hasNonNegativeCounts(value.activeByPriority, [
    "High",
    "Low",
    "Medium",
    "Urgent",
  ]);

const isStaffDashboardPreviews = (
  value: unknown
): value is StaffDashboardResponse["previews"] =>
  isRecord(value) &&
  hasExactKeys(value, [
    "myActions",
    "recentlyUpdatedTickets",
    "urgentActiveTickets",
  ]) &&
  Array.isArray(value.myActions) &&
  value.myActions.length <= 5 &&
  value.myActions.every(isMyActionRow) &&
  Array.isArray(value.recentlyUpdatedTickets) &&
  value.recentlyUpdatedTickets.length <= 5 &&
  value.recentlyUpdatedTickets.every(isStaffDashboardTicketPreview) &&
  Array.isArray(value.urgentActiveTickets) &&
  value.urgentActiveTickets.length <= 5 &&
  value.urgentActiveTickets.every(isStaffDashboardTicketPreview);

const isStaffDashboardWindow = (
  value: unknown
): value is StaffDashboardResponse["window"] =>
  isRecord(value) &&
  hasExactKeys(value, ["from", "through"]) &&
  isUtcIsoString(value.from) &&
  isUtcIsoString(value.through) &&
  new Date(value.from).getTime() <= new Date(value.through).getTime();

const isStaffDashboardResponse = (
  value: unknown
): value is StaffDashboardResponse =>
  isRecord(value) &&
  hasExactKeys(value, ["counts", "generatedAt", "previews", "window"]) &&
  isUtcIsoString(value.generatedAt) &&
  isStaffDashboardWindow(value.window) &&
  isStaffDashboardCounts(value.counts) &&
  isStaffDashboardPreviews(value.previews);

export const getStaffDashboard = async (
  signal?: AbortSignal
): Promise<StaffDashboardResponse> => {
  const response = await unwrap(
    getApiStaffDashboard({ client: apiClient, signal })
  );

  if (!isStaffDashboardResponse(response)) {
    throw invalidApiResponse(
      "The API returned an invalid Staff dashboard response."
    );
  }

  return response;
};
