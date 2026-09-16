import { ApiError } from "../errors/api-error.js";
import { Prisma } from "../generated/prisma/client.js";
import { findActiveCategory } from "../repositories/categories.js";
import { findActiveRelatedSystem } from "../repositories/related-systems.js";
import {
  indicateTicketResolution,
  updateTicketStatus,
} from "../repositories/ticket-workflow.js";
import {
  claimTicket,
  countActiveAttachments,
  createAttachments,
  createTicket,
  findEligibleOwner,
  findEligibleOwners,
  findOwnedAttachment,
  findOwnedTicket,
  findReadableAttachment,
  findStaffTicketSummaries,
  findTicketById,
  findTicketSummaries,
  removeAttachment,
  updateTicketItPriority,
  updateTicketOwner,
} from "../repositories/tickets.js";
import { currentStatusToPrisma } from "../types/ticket-workflow.js";
import type {
  ItPriorityMutationInput,
  OwnerMutationInput,
  StaffTicketListQuery,
  StatusMutationInput,
  TicketFields,
  TicketListQuery,
  TicketVersionInput,
} from "../types/tickets.js";
import type { UserRoleValue } from "../types/users.js";
import {
  removeAttachmentFiles,
  readAttachmentFile,
  writeAttachmentFile,
} from "./attachment-storage.js";
import { createTicketNumber } from "./ticket-number.js";
import {
  toAttachmentMetadata,
  toOperationalSummary,
  toOwner,
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
    try {
      await removeAttachmentFiles(stored.map(({ storageKey }) => storageKey));
    } catch {
      throw new ApiError(
        500,
        "ATTACHMENT_CLEANUP_FAILURE",
        "Unable to clean up Attachment storage."
      );
    }

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
  try {
    await removeAttachmentFiles(
      attachments.map(({ storageKey }) => storageKey)
    );
  } catch {
    throw new ApiError(
      500,
      "ATTACHMENT_CLEANUP_FAILURE",
      "Unable to clean up Attachment storage."
    );
  }
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
        const ticket = await createTicket(
          requesterId,
          ticketDate,
          ticketNumber,
          fields,
          storedAttachments
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

const readerCanAccessTicket = (role: UserRoleValue) =>
  role === "ITStaff" || role === "Administrator";

export const listStaffTickets = async (
  currentUserId: number,
  query: StaffTicketListQuery
) => {
  try {
    if (typeof query.owner === "number") {
      const owner = await findEligibleOwner(query.owner);

      if (owner === null) {
        throw new ApiError(
          400,
          "OWNER_INELIGIBLE",
          "The selected Ticket Owner is not currently eligible.",
          {
            field: "owner",
            reason: "Choose an active IT Staff or Administrator.",
          }
        );
      }
    }

    const result = await findStaffTicketSummaries(currentUserId, query);

    return {
      items: result.items.map(toOperationalSummary),
      page: query.page,
      pageSize: query.pageSize,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / query.pageSize),
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      500,
      "TICKET_QUEUE_FAILURE",
      "Unable to load the shared Ticket Queue."
    );
  }
};

export const listStaffOwners = async () => {
  try {
    const owners = await findEligibleOwners();
    return owners.map(toOwner);
  } catch {
    throw new ApiError(
      500,
      "TICKET_OWNER_LIST_FAILURE",
      "Unable to load eligible Ticket Owners."
    );
  }
};

const resolveStatusMutation = (
  outcome: Awaited<ReturnType<typeof updateTicketStatus>>
) => {
  switch (outcome.kind) {
    case "actor-ineligible": {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You do not have permission to progress this Ticket."
      );
    }
    case "confirmation-required": {
      throw new ApiError(
        400,
        "CONFIRMATION_REQUIRED",
        "Confirm this terminal Ticket transition before continuing.",
        { field: "confirmed", reason: "Set confirmed to true." }
      );
    }
    case "invalid-transition": {
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "That Ticket status transition is not allowed. Refresh and choose an available transition."
      );
    }
    case "not-found": {
      throw notFound("Ticket");
    }
    case "owner-required": {
      throw new ApiError(
        409,
        "OWNER_REQUIRED",
        "An active eligible Ticket Owner is required for this status."
      );
    }
    case "version-conflict": {
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "The Ticket changed before this action was saved. Refresh and try again."
      );
    }
    case "success": {
      return toTicketDetail(outcome.ticket);
    }
    default: {
      throw new ApiError(
        500,
        "TICKET_STATUS_FAILURE",
        "Unable to update the Ticket status."
      );
    }
  }
};

const resolveTicketMutation = (
  outcome: Awaited<ReturnType<typeof claimTicket>>
) => {
  switch (outcome.kind) {
    case "actor-ineligible": {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You do not have permission to update Ticket operations."
      );
    }
    case "not-found": {
      throw notFound("Ticket");
    }
    case "owner-ineligible": {
      throw new ApiError(
        409,
        "OWNER_INELIGIBLE",
        "The selected Ticket Owner is not currently eligible."
      );
    }
    case "version-conflict": {
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "The Ticket changed before this action was saved. Refresh and try again."
      );
    }
    case "assignment-conflict": {
      throw new ApiError(
        409,
        "ASSIGNMENT_CONFLICT",
        "The Ticket has already been claimed. Refresh to see its current Owner."
      );
    }
    case "terminal": {
      throw new ApiError(
        409,
        "TICKET_TERMINAL",
        "Terminal Tickets cannot change Owner or IT Priority."
      );
    }
    case "unchanged":
    case "success": {
      return toTicketDetail(outcome.ticket);
    }
    default: {
      throw new ApiError(
        500,
        "TICKET_MUTATION_FAILURE",
        "Unable to update the Ticket."
      );
    }
  }
};

export const updateTicketStatusForStaff = async (
  currentUserId: number,
  ticketId: number,
  input: StatusMutationInput
) =>
  resolveStatusMutation(
    await updateTicketStatus(
      currentUserId,
      ticketId,
      currentStatusToPrisma[input.currentStatus],
      input.version,
      input.confirmed
    )
  );

export const indicateTicketResolutionForRequester = async (
  currentUserId: number,
  ticketId: number
) => {
  const outcome = await indicateTicketResolution(currentUserId, ticketId);

  switch (outcome.kind) {
    case "actor-ineligible": {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You do not have permission to indicate this Ticket resolution."
      );
    }
    case "not-found": {
      throw notFound("Ticket");
    }
    case "terminal": {
      throw new ApiError(
        409,
        "TICKET_TERMINAL",
        "Terminal Tickets cannot receive a resolution indication."
      );
    }
    case "success":
    case "unchanged": {
      return {
        resolutionIndication: {
          author: outcome.indication.author,
          createdAt: outcome.indication.createdAt.toISOString(),
        },
      };
    }
    default: {
      throw new ApiError(
        500,
        "TICKET_INDICATION_FAILURE",
        "Unable to record the resolution indication."
      );
    }
  }
};

export const claimTicketForStaff = async (
  currentUserId: number,
  ticketId: number,
  input: TicketVersionInput
) =>
  resolveTicketMutation(
    await claimTicket(currentUserId, ticketId, input.version)
  );

export const updateTicketOwnerForStaff = async (
  currentUserId: number,
  ticketId: number,
  input: OwnerMutationInput
) =>
  resolveTicketMutation(
    await updateTicketOwner(
      currentUserId,
      ticketId,
      input.ownerId,
      input.version
    )
  );

export const updateTicketItPriorityForStaff = async (
  currentUserId: number,
  ticketId: number,
  input: ItPriorityMutationInput
) =>
  resolveTicketMutation(
    await updateTicketItPriority(
      currentUserId,
      ticketId,
      input.itPriority,
      input.version
    )
  );

export const getTicketForReader = async (
  userId: number,
  role: UserRoleValue,
  ticketId: number
) => {
  const ticket = readerCanAccessTicket(role)
    ? await findTicketById(ticketId)
    : await findOwnedTicket(userId, ticketId);

  if (ticket === null) {
    throw notFound("Ticket");
  }

  return toTicketDetail(ticket);
};

export const getAttachmentsForReader = async (
  userId: number,
  role: UserRoleValue,
  ticketId: number
) => {
  const ticket = readerCanAccessTicket(role)
    ? await findTicketById(ticketId)
    : await findOwnedTicket(userId, ticketId);

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
    const created = await createAttachments(
      ticketId,
      storedAttachments,
      MAX_ACTIVE_ATTACHMENTS
    );

    if (created === null) {
      throw new ApiError(
        409,
        "ATTACHMENT_LIMIT_EXCEEDED",
        "Attachment limit exceeded."
      );
    }

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

export const downloadAttachmentForReader = async (
  userId: number,
  role: UserRoleValue,
  ticketId: number,
  attachmentId: number
) => {
  const attachment = readerCanAccessTicket(role)
    ? await findReadableAttachment(ticketId, attachmentId)
    : await findOwnedAttachment(userId, ticketId, attachmentId);

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
  const attachment = await findOwnedAttachment(
    requesterId,
    ticketId,
    attachmentId
  );

  if (attachment === null) {
    throw notFound("Attachment");
  }

  try {
    // Remove content before committing metadata so cleanup failures remain retryable.
    await removeAttachmentFiles([attachment.storageKey]);
  } catch {
    throw new ApiError(
      500,
      "ATTACHMENT_CLEANUP_FAILURE",
      "Unable to clean up Attachment storage."
    );
  }

  const removed = await removeAttachment(
    requesterId,
    ticketId,
    attachmentId,
    reason,
    new Date()
  );

  if (removed === null) {
    throw notFound("Attachment");
  }

  return toAttachmentMetadata(removed);
};
