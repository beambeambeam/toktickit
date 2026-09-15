import type { CurrentStatus as PrismaCurrentStatus } from "../generated/prisma/enums.js";
import type { CurrentStatus, OwnerRecord } from "../types/tickets.js";
import { toUserRoleLabel } from "../types/users.js";
import type { UserRoleValue } from "../types/users.js";

export interface AttachmentRecord {
  byteSize: number;
  id: number;
  mediaType: string;
  originalFilename: string;
  removalReason: string | null;
  removedAt: Date | null;
  storageKey: string;
  uploadedAt: Date;
}

export interface TicketSummaryRecord {
  category: { id: number; name: string };
  currentStatus: PrismaCurrentStatus;
  id: number;
  relatedSystem: { id: number; name: string };
  requestedPriority: string;
  summary: string;
  ticketDate: Date;
  ticketNumber: string;
  updatedAt: Date;
}

export interface TicketOwnerRecord {
  displayName: string;
  id: number;
  isActive: boolean;
  role: UserRoleValue;
}

export interface TicketResolutionIndicationRecord {
  displayName: string;
  id: number;
}

export interface OperationalTicketRecord {
  itPriority: string;
  owner: TicketOwnerRecord | null;
  version: number;
}

export type TicketDetailRecord = TicketSummaryRecord &
  OperationalTicketRecord & {
    attachments: AttachmentRecord[];
    description: string;
    requester: { displayName: string; email: string; id: number };
    resolutionIndicatedAt: Date | null;
    resolutionIndicatedBy: TicketResolutionIndicationRecord | null;
    statusChangedAt: Date;
    resolvedAt: Date | null;
    reopenedAt: Date | null;
    closedAt: Date | null;
    cancelledAt: Date | null;
  };

const currentStatusLabels: Record<PrismaCurrentStatus, CurrentStatus> = {
  Cancelled: "Cancelled",
  Closed: "Closed",
  InProgress: "In Progress",
  New: "New",
  Open: "Open",
  Reopened: "Reopened",
  Resolved: "Resolved",
  WaitingForRequester: "Waiting for Requester",
};

const toCurrentStatus = (value: PrismaCurrentStatus): CurrentStatus =>
  currentStatusLabels[value];

export const toOwner = (
  owner: TicketOwnerRecord | null
): OwnerRecord | null => {
  if (owner === null) {
    return null;
  }

  return {
    displayName: owner.displayName,
    id: owner.id,
    isActive: owner.isActive,
    isEligible:
      owner.isActive &&
      (owner.role === "ITStaff" || owner.role === "Administrator"),
    role: toUserRoleLabel(owner.role),
  };
};

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

export const toAttachmentMetadata = (attachment: AttachmentRecord) => ({
  byteSize: attachment.byteSize,
  id: attachment.id,
  mediaType: attachment.mediaType,
  originalFilename: attachment.originalFilename,
  removalReason: attachment.removalReason,
  removedAt: iso(attachment.removedAt),
  state:
    attachment.removedAt === null ? ("Active" as const) : ("Removed" as const),
  uploadedAt: attachment.uploadedAt.toISOString(),
});

export const toTicketSummary = (ticket: TicketSummaryRecord) => ({
  category: ticket.category,
  currentStatus: toCurrentStatus(ticket.currentStatus),
  id: ticket.id,
  relatedSystem: ticket.relatedSystem,
  requestedPriority: ticket.requestedPriority,
  summary: ticket.summary,
  ticketDate: ticket.ticketDate.toISOString(),
  ticketNumber: ticket.ticketNumber,
  updatedAt: ticket.updatedAt.toISOString(),
});

export const toTicketDetail = (ticket: TicketDetailRecord) => ({
  ...toTicketSummary(ticket),
  attachments: ticket.attachments.map(toAttachmentMetadata),
  cancelledAt: iso(ticket.cancelledAt),
  closedAt: iso(ticket.closedAt),
  description: ticket.description,
  itPriority: ticket.itPriority,
  owner: toOwner(ticket.owner),
  reopenedAt: iso(ticket.reopenedAt),
  requester: ticket.requester,
  resolutionIndication:
    ticket.resolutionIndicatedAt !== null &&
    ticket.resolutionIndicatedBy !== null
      ? {
          author: {
            displayName: ticket.resolutionIndicatedBy.displayName,
            id: ticket.resolutionIndicatedBy.id,
          },
          createdAt: ticket.resolutionIndicatedAt.toISOString(),
        }
      : null,
  resolvedAt: iso(ticket.resolvedAt),
  statusChangedAt: ticket.statusChangedAt.toISOString(),
  version: ticket.version,
});

export const toOperationalSummary = (
  ticket: TicketSummaryRecord & OperationalTicketRecord
) => ({
  ...toTicketSummary(ticket),
  itPriority: ticket.itPriority,
  owner: toOwner(ticket.owner),
  version: ticket.version,
});
