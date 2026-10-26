import { prisma } from "../src/db/client.js";
import {
  createActionSnapshot,
  getActionPayload,
  hashActionPayload,
} from "../src/models/action-payload.js";

const categories = [
  {
    displayOrder: 1,
    name: "Account and Access",
    seedKey: "lab3:category:account-access",
  },
  { displayOrder: 2, name: "Hardware", seedKey: "lab3:category:hardware" },
  { displayOrder: 3, name: "Software", seedKey: "lab3:category:software" },
  { displayOrder: 4, name: "Network", seedKey: "lab3:category:network" },
] as const;

const relatedSystems = [
  { name: "Email", seedKey: "lab3:system:email" },
  { name: "Campus Wi-Fi", seedKey: "lab3:system:campus-wifi" },
  { name: "VPN", seedKey: "lab3:system:vpn" },
  { name: "LEB2 App", seedKey: "lab3:system:leb2-app" },
  {
    name: "Grade Submission App",
    seedKey: "lab3:system:grade-submission-app",
  },
  { name: "Printer", seedKey: "lab3:system:printer" },
  { name: "Corporate Laptop", seedKey: "lab3:system:corporate-laptop" },
] as const;

const users = [
  {
    displayName: "Ada Requester",
    email: "ada@example.test",
    isActive: true,
    role: "Requester" as const,
    seedKey: "lab3:user:requester-1",
  },
  {
    displayName: "Ben Requester",
    email: "ben@example.test",
    isActive: true,
    role: "Requester" as const,
    seedKey: "lab3:user:requester-2",
  },
  {
    displayName: "Chai Requester",
    email: "chai@example.test",
    isActive: true,
    role: "Requester" as const,
    seedKey: "lab3:user:requester-3",
  },
  {
    displayName: "Dara Requester",
    email: "dara@example.test",
    isActive: true,
    role: "Requester" as const,
    seedKey: "lab3:user:requester-4",
  },
  {
    displayName: "Inactive Requester",
    email: "inactive@example.test",
    isActive: false,
    role: "Requester" as const,
    seedKey: "lab3:user:inactive-requester",
  },
  {
    displayName: "Iris IT Staff",
    email: "staff@example.test",
    isActive: true,
    role: "ITStaff" as const,
    seedKey: "lab3:user:staff-1",
  },
  {
    displayName: "Jules IT Staff",
    email: "staff-2@example.test",
    isActive: true,
    role: "ITStaff" as const,
    seedKey: "lab3:user:staff-2",
  },
  {
    displayName: "Kanya IT Staff",
    email: "staff-3@example.test",
    isActive: true,
    role: "ITStaff" as const,
    seedKey: "lab3:user:staff-3",
  },
  {
    displayName: "Ari Administrator",
    email: "admin@example.test",
    isActive: true,
    role: "Administrator" as const,
    seedKey: "lab3:user:admin-1",
  },
  {
    displayName: "Inactive IT Staff",
    email: "inactive-staff@example.test",
    isActive: false,
    role: "ITStaff" as const,
    seedKey: "lab3:user:inactive-staff",
  },
  {
    displayName: "Inactive Administrator",
    email: "inactive-admin@example.test",
    isActive: false,
    role: "Administrator" as const,
    seedKey: "lab3:user:inactive-admin",
  },
] as const;

const insertIfMissing = async <T>(input: {
  find: () => Promise<T | null>;
  create: () => Promise<T>;
}) => {
  const existing = await input.find();
  return existing ?? (await input.create());
};

const getSeededUser = async (seedKey: string) => {
  const user = await prisma.user.findUnique({ where: { seedKey } });
  if (user === null) {
    throw new Error(`Missing seeded User ${seedKey}.`);
  }
  return user;
};

const getSeededCategory = async (seedKey: string) => {
  const category = await prisma.category.findUnique({ where: { seedKey } });
  if (category === null) {
    throw new Error(`Missing seeded Category ${seedKey}.`);
  }
  return category;
};

const getSeededSystem = async (seedKey: string) => {
  const system = await prisma.relatedSystem.findUnique({ where: { seedKey } });
  if (system === null) {
    throw new Error(`Missing seeded Related System ${seedKey}.`);
  }
  return system;
};

const getSeededTicket = async (seedKey: string) => {
  const ticket = await prisma.ticket.findUnique({ where: { seedKey } });
  if (ticket === null) {
    throw new Error(`Missing seeded Ticket ${seedKey}.`);
  }
  return ticket;
};

try {
  for (const category of categories) {
    // Preserve canonical ID order as well as renamed, reordered or deactivated rows.
    // oxlint-disable-next-line no-await-in-loop
    await insertIfMissing({
      create: async () => await prisma.category.create({ data: category }),
      find: async () =>
        await prisma.category.findUnique({
          where: { seedKey: category.seedKey },
        }),
    });
  }

  for (const [index, relatedSystem] of relatedSystems.entries()) {
    // Preserve canonical ID order as well as renamed, reordered or deactivated rows.
    // oxlint-disable-next-line no-await-in-loop
    await insertIfMissing({
      create: async () =>
        await prisma.relatedSystem.create({
          data: { ...relatedSystem, displayOrder: index + 1 },
        }),
      find: async () =>
        await prisma.relatedSystem.findUnique({
          where: { seedKey: relatedSystem.seedKey },
        }),
    });
  }

  for (const user of users) {
    // Preserve canonical ID order as well as renamed, reordered or deactivated rows.
    // oxlint-disable-next-line no-await-in-loop
    await insertIfMissing({
      create: async () =>
        await prisma.user.create({
          data: { ...user, mustChangePassword: true, passwordHash: null },
        }),
      find: async () =>
        await prisma.user.findUnique({ where: { seedKey: user.seedKey } }),
    });
  }

  const tickets = [
    {
      categoryKey: "lab3:category:network",
      currentStatus: "New" as const,
      itPriority: "Low" as const,
      ownerKey: undefined,
      relatedSystemKey: "lab3:system:campus-wifi",
      requestedPriority: "Low" as const,
      seedKey: "lab3:ticket:new-unassigned",
      summary: "New campus Wi-Fi request",
      ticketNumber: "TKT-20260901-NEW001",
    },
    {
      categoryKey: "lab3:category:account-access",
      currentStatus: "Open" as const,
      itPriority: "Medium" as const,
      ownerKey: "lab3:user:staff-1",
      relatedSystemKey: "lab3:system:vpn",
      requestedPriority: "Medium" as const,
      seedKey: "lab3:ticket:open-assigned",
      summary: "VPN access request opened",
      ticketNumber: "TKT-20260901-OPEN01",
    },
    {
      categoryKey: "lab3:category:hardware",
      currentStatus: "InProgress" as const,
      itPriority: "High" as const,
      ownerKey: "lab3:user:staff-2",
      relatedSystemKey: "lab3:system:corporate-laptop",
      requestedPriority: "High" as const,
      seedKey: "lab3:ticket:in-progress",
      summary: "Laptop cannot connect to network",
      ticketNumber: "TKT-20260901-PROG01",
    },
    {
      categoryKey: "lab3:category:software",
      currentStatus: "WaitingForRequester" as const,
      itPriority: "Urgent" as const,
      ownerKey: "lab3:user:admin-1",
      relatedSystemKey: "lab3:system:leb2-app",
      requestedPriority: "Urgent" as const,
      seedKey: "lab3:ticket:waiting-requester",
      summary: "Grade submission needs more details",
      ticketNumber: "TKT-20260901-WAIT01",
    },
    {
      categoryKey: "lab3:category:network",
      currentStatus: "Resolved" as const,
      itPriority: "High" as const,
      ownerKey: "lab3:user:staff-3",
      relatedSystemKey: "lab3:system:campus-wifi",
      requestedPriority: "Medium" as const,
      seedKey: "lab3:ticket:resolved",
      summary: "Resolved access point outage",
      ticketNumber: "TKT-20260901-RES001",
    },
    {
      categoryKey: "lab3:category:account-access",
      currentStatus: "Closed" as const,
      itPriority: "Medium" as const,
      ownerKey: "lab3:user:staff-1",
      relatedSystemKey: "lab3:system:email",
      requestedPriority: "Low" as const,
      seedKey: "lab3:ticket:closed",
      summary: "Closed mailbox access request",
      ticketNumber: "TKT-20260901-CLOS01",
    },
    {
      categoryKey: "lab3:category:software",
      currentStatus: "Reopened" as const,
      itPriority: "High" as const,
      ownerKey: "lab3:user:staff-2",
      relatedSystemKey: "lab3:system:grade-submission-app",
      requestedPriority: "High" as const,
      seedKey: "lab3:ticket:reopened",
      summary: "Reopened grade submission issue",
      ticketNumber: "TKT-20260901-REOP01",
    },
    {
      categoryKey: "lab3:category:hardware",
      currentStatus: "Cancelled" as const,
      itPriority: "Urgent" as const,
      ownerKey: "lab3:user:admin-1",
      relatedSystemKey: "lab3:system:printer",
      requestedPriority: "Urgent" as const,
      seedKey: "lab3:ticket:cancelled",
      summary: "Cancelled printer replacement",
      ticketNumber: "TKT-20260901-CANC01",
    },
  ] as const;
  const ticketDescription =
    "Seeded operational example for queue and read-only detail review.";

  for (const [index, ticket] of tickets.entries()) {
    // Stable fixture keys make reruns insert-only and preserve edited Tickets.
    // oxlint-disable-next-line no-await-in-loop
    await insertIfMissing({
      create: async () => {
        const requester = await getSeededUser("lab3:user:requester-1");
        const category = await getSeededCategory(ticket.categoryKey);
        const relatedSystem = await getSeededSystem(ticket.relatedSystemKey);
        const owner =
          ticket.ownerKey === undefined
            ? null
            : await getSeededUser(ticket.ownerKey);
        const ticketDate = new Date(Date.UTC(2026, 8, 1, 8 + index, 0, 0));
        const resolvedAt =
          ticket.currentStatus === "Resolved" ||
          ticket.currentStatus === "Closed"
            ? ticketDate
            : null;

        return await prisma.ticket.create({
          data: {
            cancelledAt:
              ticket.currentStatus === "Cancelled" ? ticketDate : null,
            categoryId: category.id,
            closedAt: ticket.currentStatus === "Closed" ? ticketDate : null,
            currentStatus: ticket.currentStatus,
            description: ticketDescription,
            itPriority: ticket.itPriority,
            ownerId: owner?.id ?? null,
            relatedSystemId: relatedSystem.id,
            requestedPriority: ticket.requestedPriority,
            requesterId: requester.id,
            resolvedAt,
            seedKey: ticket.seedKey,
            statusChangedAt: ticketDate,
            summary: ticket.summary,
            ticketDate,
            ticketNumber: ticket.ticketNumber,
          },
        });
      },
      find: async () =>
        await prisma.ticket.findUnique({ where: { seedKey: ticket.seedKey } }),
    });
  }

  const actionTickets = [
    {
      categoryKey: "lab3:category:network",
      currentStatus: "New" as const,
      itPriority: "Low" as const,
      ownerKey: undefined,
      relatedSystemKey: "lab3:system:campus-wifi",
      requestedPriority: "Low" as const,
      seedKey: "lab4:ticket:actions-empty",
      summary: "Lab 4 action list with no work yet",
      ticketNumber: "TKT-20261003-ACT001",
    },
    {
      categoryKey: "lab3:category:hardware",
      currentStatus: "Open" as const,
      itPriority: "Medium" as const,
      ownerKey: "lab3:user:staff-1",
      relatedSystemKey: "lab3:system:corporate-laptop",
      requestedPriority: "Medium" as const,
      seedKey: "lab4:ticket:actions-single",
      summary: "Lab 4 action list with one planned action",
      ticketNumber: "TKT-20261003-ACT002",
    },
    {
      categoryKey: "lab3:category:software",
      currentStatus: "InProgress" as const,
      itPriority: "High" as const,
      ownerKey: "lab3:user:staff-2",
      relatedSystemKey: "lab3:system:leb2-app",
      requestedPriority: "High" as const,
      seedKey: "lab4:ticket:actions-multiple",
      summary: "Lab 4 action list with multiple workers",
      ticketNumber: "TKT-20261003-ACT003",
    },
  ] as const;

  const actionTicketDescription =
    "Dedicated Lab 4 demonstration Ticket for planned Actions Taken.";

  for (const [index, ticket] of actionTickets.entries()) {
    // Lab 4 action fixtures use their own Ticket seed keys. Existing Lab 3
    // Tickets remain legacy rows with no fabricated Actions Taken.
    // oxlint-disable-next-line no-await-in-loop
    await insertIfMissing({
      create: async () => {
        const requester = await getSeededUser("lab3:user:requester-1");
        const category = await getSeededCategory(ticket.categoryKey);
        const relatedSystem = await getSeededSystem(ticket.relatedSystemKey);
        const owner =
          ticket.ownerKey === undefined
            ? null
            : await getSeededUser(ticket.ownerKey);
        const ticketDate = new Date(Date.UTC(2026, 9, 3, 8 + index, 0, 0));

        return await prisma.ticket.create({
          data: {
            categoryId: category.id,
            currentStatus: ticket.currentStatus,
            description: actionTicketDescription,
            itPriority: ticket.itPriority,
            ownerId: owner?.id ?? null,
            relatedSystemId: relatedSystem.id,
            requestedPriority: ticket.requestedPriority,
            requesterId: requester.id,
            seedKey: ticket.seedKey,
            statusChangedAt: ticketDate,
            summary: ticket.summary,
            ticketDate,
            ticketNumber: ticket.ticketNumber,
            updatedAt: ticketDate,
          },
        });
      },
      find: async () =>
        await prisma.ticket.findUnique({ where: { seedKey: ticket.seedKey } }),
    });
  }

  const actions = [
    {
      assigneeKey: "lab3:user:staff-1",
      attachmentNotes: null,
      createdByKey: "lab3:user:staff-1",
      description: "Check the laptop network adapter and cable.",
      followUpNote: null,
      followUpRequired: false,
      requestId: "d33d3a4e-6f9c-4ca7-9a22-2a4f5963e001",
      result: null,
      seedKey: "lab4:action:single-network-check",
      ticketKey: "lab4:ticket:actions-single",
    },
    {
      assigneeKey: "lab3:user:staff-2",
      attachmentNotes: "Look for the screenshot in the Ticket attachments.",
      createdByKey: "lab3:user:staff-2",
      description: "Reproduce the grade submission failure.",
      followUpNote: "Ask the requester to retry after the check.",
      followUpRequired: true,
      requestId: "d33d3a4e-6f9c-4ca7-9a22-2a4f5963e002",
      result: null,
      seedKey: "lab4:action:multiple-reproduce",
      ticketKey: "lab4:ticket:actions-multiple",
    },
    {
      assigneeKey: "lab3:user:staff-3",
      attachmentNotes: null,
      createdByKey: "lab3:user:staff-3",
      description: "Review application logs for the failed submission.",
      followUpNote: null,
      followUpRequired: false,
      requestId: "d33d3a4e-6f9c-4ca7-9a22-2a4f5963e003",
      result: null,
      seedKey: "lab4:action:multiple-log-review",
      ticketKey: "lab4:ticket:actions-multiple",
    },
  ] as const;

  for (const [index, action] of actions.entries()) {
    // Stable action keys make reruns insert-only and preserve edited action
    // records. Each new action receives its immutable initial event together.
    // oxlint-disable-next-line no-await-in-loop
    const ticket = await getSeededTicket(action.ticketKey);
    // oxlint-disable-next-line no-await-in-loop
    const creator = await getSeededUser(action.createdByKey);
    // oxlint-disable-next-line no-await-in-loop
    const assignee = await getSeededUser(action.assigneeKey);
    const actionDate = new Date(Date.UTC(2026, 9, 3, 12 + index, 0, 0));
    const payload = getActionPayload(action, assignee.id);
    const snapshot = createActionSnapshot(payload);
    const payloadHash = hashActionPayload(payload);

    // oxlint-disable-next-line no-await-in-loop
    const existing = await prisma.actionTaken.findUnique({
      where: { seedKey: action.seedKey },
    });
    let actionRecord = existing;
    // oxlint-disable-next-line no-await-in-loop
    actionRecord ??= await prisma.actionTaken.create({
      data: {
        assigneeId: assignee.id,
        attachmentNotes: action.attachmentNotes,
        createdAt: actionDate,
        createdByUserId: creator.id,
        description: action.description,
        followUpNote: action.followUpNote,
        followUpRequired: action.followUpRequired,
        payloadHash,
        requestId: action.requestId,
        result: action.result,
        seedKey: action.seedKey,
        ticketId: ticket.id,
        updatedAt: actionDate,
      },
    });

    // Repair only a missing initial event; never update an existing action or
    // event so seed reruns preserve user edits and historical rows.
    // oxlint-disable-next-line no-await-in-loop
    await insertIfMissing({
      create: async () =>
        await prisma.actionEvent.create({
          data: {
            actionId: actionRecord.id,
            actionVersion: actionRecord.version,
            actorId: actionRecord.createdByUserId,
            createdAt: actionDate,
            eventType: "ActionCreated",
            snapshot,
            toStatus: "Planned",
          },
        }),
      find: async () =>
        await prisma.actionEvent.findUnique({
          where: {
            actionId_actionVersion: {
              actionId: actionRecord.id,
              actionVersion: actionRecord.version,
            },
          },
        }),
    });
  }
} finally {
  await prisma.$disconnect();
}
