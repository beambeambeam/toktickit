import { prisma } from "../db/client.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { TicketFields, TicketListQuery } from "../types/tickets.js";

const categorySelection = {
  id: true,
  name: true,
} as const;

const relatedSystemSelection = {
  id: true,
  name: true,
} as const;

const requesterSelection = {
  displayName: true,
  email: true,
  id: true,
} as const;

const attachmentSelection = {
  byteSize: true,
  id: true,
  mediaType: true,
  originalFilename: true,
  removalReason: true,
  removedAt: true,
  removedByRequesterId: true,
  storageKey: true,
  uploadedAt: true,
} as const;

export const ticketDetailInclude = {
  attachments: {
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    select: attachmentSelection,
  },
  category: { select: categorySelection },
  relatedSystem: { select: relatedSystemSelection },
  requester: { select: requesterSelection },
} satisfies Prisma.TicketInclude;

export const ticketSummaryInclude = {
  category: { select: categorySelection },
  relatedSystem: { select: relatedSystemSelection },
} satisfies Prisma.TicketInclude;

export const findOwnedTicket = async (requesterId: number, ticketId: number) =>
  await prisma.ticket.findFirst({
    include: ticketDetailInclude,
    where: { id: ticketId, requesterId },
  });

export const findOwnedAttachment = async (
  requesterId: number,
  ticketId: number,
  attachmentId: number
) =>
  await prisma.attachment.findFirst({
    select: {
      ...attachmentSelection,
      ticketId: true,
    },
    where: {
      id: attachmentId,
      removedAt: null,
      ticket: { id: ticketId, requesterId },
    },
  });

export const findOwnedAttachmentMetadata = async (
  requesterId: number,
  ticketId: number,
  attachmentId: number
) =>
  await prisma.attachment.findFirst({
    select: {
      ...attachmentSelection,
      ticketId: true,
    },
    where: {
      id: attachmentId,
      ticket: { id: ticketId, requesterId },
    },
  });

export const countActiveAttachments = async (ticketId: number) =>
  await prisma.attachment.count({
    where: { removedAt: null, ticketId },
  });

const buildTicketWhere = (
  requesterId: number,
  query: TicketListQuery
): Prisma.TicketWhereInput => ({
  ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
  ...(query.currentStatus === undefined
    ? {}
    : { currentStatus: query.currentStatus }),
  ...(query.relatedSystemId === undefined
    ? {}
    : { relatedSystemId: query.relatedSystemId }),
  ...(query.requestedPriority === undefined
    ? {}
    : { requestedPriority: query.requestedPriority }),
  ...(query.search === undefined
    ? {}
    : {
        OR: [
          { ticketNumber: { contains: query.search, mode: "insensitive" } },
          { summary: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ],
      }),
  requesterId,
});

export const findTicketSummaries = async (
  requesterId: number,
  query: TicketListQuery
) => {
  const where = buildTicketWhere(requesterId, query);
  const direction = query.sortDirection;
  const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
    { [query.sortBy]: direction },
    { id: direction },
  ];

  const [totalItems, items] = await prisma.$transaction([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      include: ticketSummaryInclude,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    }),
  ]);

  return { items, totalItems };
};

type TicketDatabase = Prisma.TransactionClient;

export const insertTicket = async (
  database: TicketDatabase,
  requesterId: number,
  ticketDate: Date,
  ticketNumber: string,
  fields: TicketFields,
  attachments: readonly {
    byteSize: number;
    mediaType: string;
    originalFilename: string;
    storageKey: string;
  }[]
) =>
  await database.ticket.create({
    data: {
      attachments: {
        create: attachments.map((attachment) => ({
          byteSize: attachment.byteSize,
          mediaType: attachment.mediaType,
          originalFilename: attachment.originalFilename,
          storageKey: attachment.storageKey,
        })),
      },
      categoryId: fields.categoryId,
      currentStatus: "New",
      description: fields.description,
      relatedSystemId: fields.relatedSystemId,
      requestedPriority: fields.requestedPriority,
      requesterId,
      summary: fields.summary,
      ticketDate,
      ticketNumber,
    },
    include: ticketDetailInclude,
  });

export const insertAttachments = async (
  database: TicketDatabase,
  ticketId: number,
  attachments: readonly {
    byteSize: number;
    mediaType: string;
    originalFilename: string;
    storageKey: string;
  }[]
) => {
  await database.attachment.createMany({
    data: attachments.map((attachment) => ({
      byteSize: attachment.byteSize,
      mediaType: attachment.mediaType,
      originalFilename: attachment.originalFilename,
      storageKey: attachment.storageKey,
      ticketId,
    })),
  });

  return await database.attachment.findMany({
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    select: attachmentSelection,
    where: {
      storageKey: { in: attachments.map(({ storageKey }) => storageKey) },
    },
  });
};

export const countActiveAttachmentsInTransaction = async (
  database: TicketDatabase,
  ticketId: number
) =>
  await database.attachment.count({
    where: { removedAt: null, ticketId },
  });

export const touchTicket = async (database: TicketDatabase, ticketId: number) =>
  await database.ticket.update({
    data: { updatedAt: new Date() },
    where: { id: ticketId },
  });

export const removeAttachment = async (
  requesterId: number,
  ticketId: number,
  attachmentId: number,
  reason: string,
  removedAt: Date
) =>
  await prisma.attachment.update({
    data: {
      removalReason: reason,
      removedAt,
      removedByRequesterId: requesterId,
    },
    select: attachmentSelection,
    where: { id: attachmentId, ticketId },
  });
