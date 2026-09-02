import { prisma } from "../src/db/client.js";

const categories = [
  { displayOrder: 1, name: "Account and Access" },
  { displayOrder: 2, name: "Hardware" },
  { displayOrder: 3, name: "Software" },
  { displayOrder: 4, name: "Network" },
] as const;

const relatedSystems = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
] as const;

const requesters = [
  { displayName: "Ada Requester", email: "ada@example.test", isActive: true },
  { displayName: "Ben Requester", email: "ben@example.test", isActive: true },
  { displayName: "Chai Requester", email: "chai@example.test", isActive: true },
  { displayName: "Dara Requester", email: "dara@example.test", isActive: true },
  {
    displayName: "Inactive Requester",
    email: "inactive@example.test",
    isActive: false,
  },
] as const;

try {
  for (const category of categories) {
    // eslint-disable-next-line no-await-in-loop -- preserve canonical insertion order
    await prisma.category.upsert({
      create: { ...category, isActive: true },
      update: { ...category, isActive: true },
      where: { name: category.name },
    });
  }

  for (const [index, name] of relatedSystems.entries()) {
    // eslint-disable-next-line no-await-in-loop -- preserve display order
    await prisma.relatedSystem.upsert({
      create: { displayOrder: index + 1, name },
      update: { displayOrder: index + 1, isActive: true },
      where: { name },
    });
  }

  for (const requester of requesters) {
    // eslint-disable-next-line no-await-in-loop -- keep seed writes deterministic
    await prisma.developmentRequester.upsert({
      create: requester,
      update: requester,
      where: { email: requester.email },
    });
  }
} finally {
  await prisma.$disconnect();
}
