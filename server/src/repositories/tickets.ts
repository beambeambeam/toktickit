import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type { CurrentStatus as PrismaCurrentStatus } from "../generated/prisma/enums.js";
import type {
  StaffTicketOwnerFilter,
  StaffTicketListQuery,
  TicketFields,
  TicketListQuery,
} from "../types/tickets.js";

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

const ownerSelection = {
  displayName: true,
  id: true,
  isActive: true,
  role: true,
} as const;

const attachmentSelection = {
  byteSize: true,
  id: true,
  mediaType: true,
  originalFilename: true,
  removalReason: true,
  removedAt: true,
  removedByUserId: true,
  storageKey: true,
  uploadedAt: true,
} as const;

export const ticketDetailInclude = {
  attachments: {
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    select: attachmentSelection,
  },
  category: { select: categorySelection },
  owner: { select: ownerSelection },
  relatedSystem: { select: relatedSystemSelection },
  requester: { select: requesterSelection },
  resolutionIndicatedBy: {
    select: { displayName: true, id: true },
  },
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

export const findTicketById = async (ticketId: number) =>
  await prisma.ticket.findUnique({
    include: ticketDetailInclude,
    where: { id: ticketId },
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

export const findReadableAttachment = async (
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
      ticketId,
    },
  });

export const countActiveAttachments = async (ticketId: number) =>
  await prisma.attachment.count({
    where: { removedAt: null, ticketId },
  });

const escapeLikePattern = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

const currentStatusByWire: Record<
  Exclude<StaffTicketListQuery["currentStatus"], undefined>,
  PrismaCurrentStatus
> = {
  Cancelled: "Cancelled",
  Closed: "Closed",
  "In Progress": "InProgress",
  New: "New",
  Open: "Open",
  Reopened: "Reopened",
  Resolved: "Resolved",
  "Waiting for Requester": "WaitingForRequester",
};

const buildTicketWhere = (
  requesterId: number,
  query: TicketListQuery
): Prisma.TicketWhereInput => ({
  ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
  ...(query.currentStatus === undefined
    ? {}
    : { currentStatus: currentStatusByWire[query.currentStatus] }),
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
          {
            ticketNumber: {
              contains: escapeLikePattern(query.search),
              mode: "insensitive",
            },
          },
          {
            summary: {
              contains: escapeLikePattern(query.search),
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: escapeLikePattern(query.search),
              mode: "insensitive",
            },
          },
        ],
      }),
  requesterId,
});

const resolveOwnerId = (
  owner: StaffTicketOwnerFilter,
  currentUserId: number
): number | null => {
  if (owner === "me") {
    return currentUserId;
  }

  if (owner === "unassigned") {
    return null;
  }

  return owner;
};

const buildStaffTicketWhere = (
  query: StaffTicketListQuery,
  currentUserId: number
): Prisma.TicketWhereInput => ({
  ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
  ...(query.currentStatus === undefined
    ? {}
    : { currentStatus: currentStatusByWire[query.currentStatus] }),
  ...(query.itPriority === undefined ? {} : { itPriority: query.itPriority }),
  ...(query.owner === undefined
    ? {}
    : { ownerId: resolveOwnerId(query.owner, currentUserId) }),
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
          {
            ticketNumber: {
              contains: escapeLikePattern(query.search),
              mode: "insensitive",
            },
          },
          {
            summary: {
              contains: escapeLikePattern(query.search),
              mode: "insensitive",
            },
          },
        ],
      }),
});

const staffTicketSummaryInclude = {
  category: { select: categorySelection },
  owner: { select: ownerSelection },
  relatedSystem: { select: relatedSystemSelection },
} satisfies Prisma.TicketInclude;

export const findEligibleOwners = async () =>
  await prisma.user.findMany({
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: ownerSelection,
    where: { isActive: true, role: { in: ["ITStaff", "Administrator"] } },
  });

export const findEligibleOwner = async (id: number) =>
  await prisma.user.findFirst({
    select: ownerSelection,
    where: { id, isActive: true, role: { in: ["ITStaff", "Administrator"] } },
  });

export const findStaffTicketSummaries = async (
  currentUserId: number,
  query: StaffTicketListQuery
) => {
  const where = buildStaffTicketWhere(query, currentUserId);
  const direction = query.sortDirection;
  const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
    { [query.sortBy]: direction },
    { id: direction },
  ];

  return await prisma.$transaction(
    async (database) => {
      const totalItems = await database.ticket.count({ where });
      const items = await database.ticket.findMany({
        include: staffTicketSummaryInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      });

      return { items, totalItems };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
  );
};

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
      itPriority: fields.requestedPriority,
      relatedSystemId: fields.relatedSystemId,
      requestedPriority: fields.requestedPriority,
      requesterId,
      statusChangedAt: ticketDate,
      summary: fields.summary,
      ticketDate,
      ticketNumber,
    },
    include: ticketDetailInclude,
  });

export const createTicket = async (
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
  await prisma.$transaction(
    async (database) =>
      await insertTicket(
        database,
        requesterId,
        ticketDate,
        ticketNumber,
        fields,
        attachments
      )
  );

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

const lockTicketForAttachmentMutation = async (
  database: TicketDatabase,
  ticketId: number
) => {
  await database.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`
  );
};

export const touchTicket = async (database: TicketDatabase, ticketId: number) =>
  await database.ticket.update({
    data: { updatedAt: new Date() },
    where: { id: ticketId },
  });

export const createAttachments = async (
  ticketId: number,
  attachments: readonly {
    byteSize: number;
    mediaType: string;
    originalFilename: string;
    storageKey: string;
  }[],
  maxActiveAttachments: number
) =>
  await prisma.$transaction(async (database) => {
    await lockTicketForAttachmentMutation(database, ticketId);
    const currentActiveCount = await countActiveAttachmentsInTransaction(
      database,
      ticketId
    );

    if (currentActiveCount + attachments.length > maxActiveAttachments) {
      return null;
    }

    const records = await insertAttachments(database, ticketId, attachments);
    await touchTicket(database, ticketId);
    return records;
  });

export const removeAttachment = async (
  requesterId: number,
  ticketId: number,
  attachmentId: number,
  reason: string,
  removedAt: Date
) =>
  await prisma.$transaction(async (database) => {
    const result = await database.attachment.updateMany({
      data: {
        removalReason: reason,
        removedAt,
        removedByUserId: requesterId,
      },
      where: {
        id: attachmentId,
        removedAt: null,
        ticket: { id: ticketId, requesterId },
      },
    });

    if (result.count === 0) {
      return null;
    }

    return await database.attachment.findUnique({
      select: attachmentSelection,
      where: { id: attachmentId },
    });
  });
