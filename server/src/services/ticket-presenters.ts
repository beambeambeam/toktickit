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
  currentStatus: string;
  id: number;
  relatedSystem: { id: number; name: string };
  requestedPriority: string;
  summary: string;
  ticketDate: Date;
  ticketNumber: string;
  updatedAt: Date;
}

export type TicketDetailRecord = TicketSummaryRecord & {
  attachments: AttachmentRecord[];
  description: string;
  requester: { displayName: string; email: string; id: number };
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
  currentStatus: ticket.currentStatus,
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
  description: ticket.description,
  requester: ticket.requester,
});
