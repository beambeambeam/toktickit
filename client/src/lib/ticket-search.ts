import type {
  CurrentStatus,
  StaffTicketScope,
} from "@/generated/hey-api/types.gen";
import type { RequestedPriority } from "@/lib/ticket-priorities";
import { isRequestedPriority } from "@/lib/ticket-priorities";
import { isCurrentStatus } from "@/lib/ticket-statuses";

const utcTimestampPattern =
  /^(?<seconds>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(?<fraction>\d{1,3}))?Z$/u;

const parseUtcTimestamp = (value: unknown): Date | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = utcTimestampPattern.exec(value);
  const date = new Date(value);
  if (match?.groups === undefined || Number.isNaN(date.getTime())) {
    return undefined;
  }
  const fraction = match.groups.fraction?.padEnd(3, "0") ?? "000";
  return date.toISOString() === `${match.groups.seconds}.${fraction}Z`
    ? date
    : undefined;
};

/** Keep a time window only when both ends are valid UTC instants in order. */
export const parseTimeWindow = (
  from: unknown,
  through: unknown
): { from: string; through: string } | undefined => {
  const start = parseUtcTimestamp(from);
  const end = parseUtcTimestamp(through);
  if (
    start === undefined ||
    end === undefined ||
    start > end ||
    typeof from !== "string" ||
    typeof through !== "string"
  ) {
    return undefined;
  }
  return { from, through };
};

/** Ticket Queue filters the URL may carry. Drill-down links from the dashboard set these. */
export interface StaffTicketSearch {
  currentStatus?: CurrentStatus;
  from?: string;
  itPriority?: RequestedPriority;
  owner?: number | "me" | "unassigned";
  scope?: StaffTicketScope;
  through?: string;
}

const staffTicketScopes: ReadonlySet<string> = new Set([
  "active",
  "recently-updated",
  "urgent-active",
]);

export const isStaffTicketScope = (value: unknown): value is StaffTicketScope =>
  typeof value === "string" && staffTicketScopes.has(value);

const isOwnerSearch = (value: unknown): value is number | "me" | "unassigned" =>
  value === "me" ||
  value === "unassigned" ||
  (typeof value === "number" && Number.isSafeInteger(value) && value > 0);

/**
 * Drop any value the Ticket Queue cannot send to the API. A time window is kept
 * only with the recently-updated scope, and recently-updated is dropped when its
 * window is invalid, so a malformed link never produces a 400 request.
 */
export const parseStaffTicketSearch = (
  search: Record<string, unknown>
): StaffTicketSearch => {
  const window =
    search.scope === "recently-updated"
      ? parseTimeWindow(search.from, search.through)
      : undefined;
  const scope = isStaffTicketScope(search.scope) ? search.scope : undefined;
  const effectiveScope =
    scope === "recently-updated" && window === undefined ? undefined : scope;
  const owner = isOwnerSearch(search.owner) ? search.owner : undefined;
  const currentStatus = isCurrentStatus(search.currentStatus)
    ? search.currentStatus
    : undefined;
  const itPriority = isRequestedPriority(search.itPriority)
    ? search.itPriority
    : undefined;

  return {
    ...(effectiveScope === undefined ? {} : { scope: effectiveScope }),
    ...(effectiveScope === "recently-updated" ? window : {}),
    ...(owner === undefined ? {} : { owner }),
    ...(currentStatus === undefined ? {} : { currentStatus }),
    ...(itPriority === undefined ? {} : { itPriority }),
  };
};

/** True when a recently-updated link carried a window the Queue had to drop. */
export const hasIgnoredTimeWindow = (searchStr: string): boolean => {
  const search = new URLSearchParams(searchStr);
  return (
    search.get("scope") === "recently-updated" &&
    parseTimeWindow(
      search.get("from") ?? undefined,
      search.get("through") ?? undefined
    ) === undefined
  );
};
