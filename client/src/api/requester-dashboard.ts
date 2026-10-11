import { apiClient } from "@/api/client";
import { invalidApiResponse, unwrap } from "@/api/errors";
import { getApiRequesterDashboard } from "@/generated/hey-api/sdk.gen";
import type {
  RequesterDashboardResponse,
  RequesterTicketPreview,
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

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isRequesterTicketPreview = (
  value: unknown
): value is RequesterTicketPreview => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "currentStatus",
      "id",
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
    Number.isSafeInteger(value.id) &&
    typeof value.id === "number" &&
    typeof value.ticketNumber === "string" &&
    typeof value.summary === "string" &&
    isCurrentStatus(value.currentStatus) &&
    isRequestedPriority(value.requestedPriority) &&
    isUtcIsoString(value.updatedAt) &&
    (value.resolvedAt === null || isUtcIsoString(value.resolvedAt))
  );
};

const isRequesterDashboardResponse = (
  value: unknown
): value is RequesterDashboardResponse => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["counts", "generatedAt", "previews", "window"])
  ) {
    return false;
  }

  const { window } = value;
  const { counts } = value;
  const { previews } = value;
  if (
    !isRecord(window) ||
    !hasExactKeys(window, ["from", "through"]) ||
    !isRecord(counts) ||
    !hasExactKeys(counts, [
      "activeTickets",
      "recentlyResolved",
      "recentlyUpdated",
      "waitingForRequester",
    ]) ||
    !isRecord(previews) ||
    !hasExactKeys(previews, ["recentlyResolved", "recentlyUpdated"])
  ) {
    return false;
  }

  return (
    isUtcIsoString(value.generatedAt) &&
    isUtcIsoString(window.from) &&
    isUtcIsoString(window.through) &&
    new Date(window.from).getTime() <= new Date(window.through).getTime() &&
    Object.values(counts).every(isNonNegativeSafeInteger) &&
    Array.isArray(previews.recentlyUpdated) &&
    previews.recentlyUpdated.length <= 5 &&
    previews.recentlyUpdated.every(isRequesterTicketPreview) &&
    Array.isArray(previews.recentlyResolved) &&
    previews.recentlyResolved.length <= 5 &&
    previews.recentlyResolved.every(isRequesterTicketPreview)
  );
};

export const getRequesterDashboard = async (
  signal?: AbortSignal
): Promise<RequesterDashboardResponse> => {
  const response = await unwrap(
    getApiRequesterDashboard({ client: apiClient, signal })
  );

  if (!isRequesterDashboardResponse(response)) {
    throw invalidApiResponse(
      "The API returned an invalid Requester dashboard response."
    );
  }

  return response;
};
