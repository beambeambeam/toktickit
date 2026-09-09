import { prisma } from "../src/db/client.js";

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
} finally {
  await prisma.$disconnect();
}
