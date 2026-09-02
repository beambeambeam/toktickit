import { prisma } from "../db/client.js";
import { ApiError } from "../errors/api-error.js";
import { Prisma } from "../generated/prisma/client.js";
import { findActiveCategory } from "../repositories/categories.js";
import { findActiveRelatedSystem } from "../repositories/related-systems.js";
import {
  countActiveAttachments,
  countActiveAttachmentsInTransaction,
  findOwnedAttachment,
  findOwnedAttachmentMetadata,
  findOwnedTicket,
  findTicketSummaries,
  insertAttachments,
  insertTicket,
  removeAttachment,
  touchTicket,
} from "../repositories/tickets.js";
import type { TicketFields, TicketListQuery } from "../types/tickets.js";
import {
  removeAttachmentFiles,
  readAttachmentFile,
  writeAttachmentFile,
} from "./attachment-storage.js";
import { createTicketNumber } from "./ticket-number.js";
import {
  toAttachmentMetadata,
  toTicketDetail,
  toTicketSummary,
} from "./ticket-presenters.js";
import {
  MAX_ACTIVE_ATTACHMENTS,
  validateAttachmentFiles,
} from "./ticket-rules.js";
import type { AttachmentCandidate } from "./ticket-rules.js";

interface StoredAttachment {
  byteSize: number;
  mediaType: string;
  originalFilename: string;
  storageKey: string;
}

const TICKET_NUMBER_ATTEMPTS = 5;

const notFound = (resource: string) =>
  new ApiError(404, "RESOURCE_NOT_FOUND", `${resource} was not found.`);

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const storeAttachments = async (
  attachments: ReturnType<typeof validateAttachmentFiles>
): Promise<StoredAttachment[]> => {
  const stored: StoredAttachment[] = [];

  try {
    for (const attachment of attachments) {
      // Storage keys must be generated and written in sequence for cleanup.
      // oxlint-disable-next-line no-await-in-loop
      const storageKey = await writeAttachmentFile(attachment.buffer);
      stored.push({
        byteSize: attachment.byteSize,
        mediaType: attachment.mediaType,
        originalFilename: attachment.originalFilename,
        storageKey,
      });
    }

    return stored;
  } catch {
    await removeAttachmentFiles(stored.map(({ storageKey }) => storageKey));
    throw new ApiError(
      500,
      "ATTACHMENT_STORAGE_FAILURE",
      "Unable to store attachments."
    );
  }
};

const cleanupStoredAttachments = async (
  attachments: readonly StoredAttachment[]
) => {
  await removeAttachmentFiles(attachments.map(({ storageKey }) => storageKey));
};

const requireActiveReferences = async (fields: TicketFields) => {
  const [category, relatedSystem] = await Promise.all([
    findActiveCategory(fields.categoryId),
    findActiveRelatedSystem(fields.relatedSystemId),
  ]);

  if (category === null) {
    throw new ApiError(
      404,
      "CATEGORY_NOT_FOUND",
      "Selected Category is unavailable.",
      { field: "categoryId", reason: "Choose an active Category." }
    );
  }

  if (relatedSystem === null) {
    throw new ApiError(
      404,
      "RELATED_SYSTEM_NOT_FOUND",
      "Selected Related System is unavailable.",
      { field: "relatedSystemId", reason: "Choose an active Related System." }
    );
  }
};

export const createTicketForRequester = async (
  requesterId: number,
  fields: TicketFields,
  attachmentCandidates: readonly AttachmentCandidate[]
) => {
  await requireActiveReferences(fields);
  const attachments = validateAttachmentFiles(attachmentCandidates);
  const storedAttachments = await storeAttachments(attachments);
  const ticketDate = new Date();

  try {
    for (let attempt = 0; attempt < TICKET_NUMBER_ATTEMPTS; attempt += 1) {
      const ticketNumber = createTicketNumber(ticketDate);

      try {
        // Retry only the generated identity; the transaction remains atomic.
        // oxlint-disable-next-line no-await-in-loop
        const ticket = await prisma.$transaction(
          async (database) =>
            await insertTicket(
              database,
              requesterId,
              ticketDate,
              ticketNumber,
              fields,
              storedAttachments
            )
        );

        return toTicketDetail(ticket);
      } catch (error: unknown) {
        if (
          isUniqueConstraintError(error) &&
          attempt < TICKET_NUMBER_ATTEMPTS - 1
        ) {
          continue;
        }

        if (isUniqueConstraintError(error)) {
          throw new ApiError(
            409,
            "TICKET_NUMBER_CONFLICT",
            "Unable to allocate a unique Ticket Number."
          );
        }

        throw new ApiError(
          500,
          "TICKET_CREATE_FAILURE",
          "Unable to create Ticket."
        );
      }
    }

    throw new ApiError(
      409,
      "TICKET_NUMBER_CONFLICT",
      "Unable to allocate a unique Ticket Number."
    );
  } catch (error: unknown) {
    await cleanupStoredAttachments(storedAttachments);
    throw error;
  }
};

export const listTicketsForRequester = async (
  requesterId: number,
  query: TicketListQuery
) => {
  try {
    const result = await findTicketSummaries(requesterId, query);

    return {
      items: result.items.map(toTicketSummary),
      page: query.page,
      pageSize: query.pageSize,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / query.pageSize),
    };
  } catch {
    throw new ApiError(500, "TICKET_LIST_FAILURE", "Unable to load Tickets.");
  }
};

export const getTicketForRequester = async (
  requesterId: number,
  ticketId: number
) => {
  const ticket = await findOwnedTicket(requesterId, ticketId);

  if (ticket === null) {
    throw notFound("Ticket");
  }

  return toTicketDetail(ticket);
};

export const getAttachmentsForRequester = async (
  requesterId: number,
  ticketId: number
) => {
  const ticket = await findOwnedTicket(requesterId, ticketId);

  if (ticket === null) {
    throw notFound("Ticket");
  }

  return ticket.attachments.map(toAttachmentMetadata);
};

export const addAttachmentsForRequester = async (
  requesterId: number,
  ticketId: number,
  attachmentCandidates: readonly AttachmentCandidate[]
) => {
  const ticket = await findOwnedTicket(requesterId, ticketId);

  if (ticket === null) {
    throw notFound("Ticket");
  }

  if (attachmentCandidates.length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "attachments",
      reason: "At least one attachment is required.",
    });
  }

  const activeCount = await countActiveAttachments(ticketId);
  const attachments = validateAttachmentFiles(
    attachmentCandidates,
    activeCount
  );
  const storedAttachments = await storeAttachments(attachments);

  try {
    const created = await prisma.$transaction(async (database) => {
      const currentActiveCount = await countActiveAttachmentsInTransaction(
        database,
        ticketId
      );

      if (
        currentActiveCount + storedAttachments.length >
        MAX_ACTIVE_ATTACHMENTS
      ) {
        throw new ApiError(
          409,
          "ATTACHMENT_LIMIT_EXCEEDED",
          "Attachment limit exceeded."
        );
      }

      const records = await insertAttachments(
        database,
        ticketId,
        storedAttachments
      );
      await touchTicket(database, ticketId);
      return records;
    });

    return created.map(toAttachmentMetadata);
  } catch (error: unknown) {
    await cleanupStoredAttachments(storedAttachments);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      500,
      "ATTACHMENT_CREATE_FAILURE",
      "Unable to add attachments."
    );
  }
};

export const downloadAttachmentForRequester = async (
  requesterId: number,
  ticketId: number,
  attachmentId: number
) => {
  const attachment = await findOwnedAttachment(
    requesterId,
    ticketId,
    attachmentId
  );

  if (attachment === null) {
    throw notFound("Attachment");
  }

  try {
    return {
      content: await readAttachmentFile(attachment.storageKey),
      mediaType: attachment.mediaType,
      originalFilename: attachment.originalFilename,
    };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw notFound("Attachment");
    }

    throw new ApiError(
      500,
      "ATTACHMENT_READ_FAILURE",
      "Unable to read attachment content."
    );
  }
};

export const removeAttachmentForRequester = async (
  requesterId: number,
  ticketId: number,
  attachmentId: number,
  reason: string
) => {
  const attachment = await findOwnedAttachmentMetadata(
    requesterId,
    ticketId,
    attachmentId
  );

  if (attachment === null || attachment.removedAt !== null) {
    throw notFound("Attachment");
  }

  const removedAt = new Date();
  const removed = await removeAttachment(
    requesterId,
    ticketId,
    attachmentId,
    reason,
    removedAt
  );

  await removeAttachmentFiles([attachment.storageKey]);
  return toAttachmentMetadata(removed);
};
