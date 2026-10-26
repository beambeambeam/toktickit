import type {
  AttachmentMetadata,
  Owner,
  ResolutionIndication,
  TicketDetail,
  TicketRequester,
  UserRole,
} from "@/generated/hey-api/types.gen";
import { isRequestedPriority } from "@/lib/ticket-priorities";
import { isCurrentStatus } from "@/lib/ticket-statuses";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isUserRole = (value: unknown): value is UserRole =>
  value === "Requester" || value === "IT Staff" || value === "Administrator";

const isNamedReference = (
  value: unknown
): value is { id: number; name: string } =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.name === "string";

const isOwner = (value: unknown): value is Owner =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.displayName === "string" &&
  isUserRole(value.role) &&
  typeof value.isActive === "boolean" &&
  typeof value.isEligible === "boolean";

const isTicketRequester = (value: unknown): value is TicketRequester =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.displayName === "string" &&
  typeof value.email === "string";

const isAttachmentMetadata = (value: unknown): value is AttachmentMetadata =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.originalFilename === "string" &&
  typeof value.mediaType === "string" &&
  Number.isSafeInteger(value.byteSize) &&
  typeof value.byteSize === "number" &&
  value.byteSize >= 0 &&
  typeof value.uploadedAt === "string" &&
  (value.state === "Active" || value.state === "Removed") &&
  isNullableString(value.removedAt) &&
  isNullableString(value.removalReason);

const isResolutionIndication = (
  value: unknown
): value is ResolutionIndication =>
  isRecord(value) &&
  isRecord(value.author) &&
  isPositiveSafeInteger(value.author.id) &&
  typeof value.author.displayName === "string" &&
  typeof value.createdAt === "string";

// oxlint-disable-next-line complexity -- validate every generated TicketDetail field before caching it.
export const isTicketDetail = (value: unknown): value is TicketDetail =>
  isRecord(value) &&
  isPositiveSafeInteger(value.id) &&
  typeof value.ticketNumber === "string" &&
  typeof value.ticketDate === "string" &&
  typeof value.summary === "string" &&
  isNamedReference(value.category) &&
  isNamedReference(value.relatedSystem) &&
  isRequestedPriority(value.requestedPriority) &&
  isCurrentStatus(value.currentStatus) &&
  typeof value.updatedAt === "string" &&
  isTicketRequester(value.requester) &&
  typeof value.description === "string" &&
  Array.isArray(value.attachments) &&
  value.attachments.every(isAttachmentMetadata) &&
  isRequestedPriority(value.itPriority) &&
  (value.owner === null || isOwner(value.owner)) &&
  isPositiveSafeInteger(value.version) &&
  (value.resolutionIndication === null ||
    isResolutionIndication(value.resolutionIndication)) &&
  typeof value.statusChangedAt === "string" &&
  isNullableString(value.resolvedAt) &&
  isNullableString(value.reopenedAt) &&
  isNullableString(value.closedAt) &&
  isNullableString(value.cancelledAt);
