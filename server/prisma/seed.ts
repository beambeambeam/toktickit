import { prisma } from "../src/db/client.js";

const canonicalCategoryNames = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
] as const;

try {
  for (const name of canonicalCategoryNames) {
    // eslint-disable-next-line no-await-in-loop -- preserve canonical insertion order
    await prisma.category.upsert({
      create: { name },
      update: {},
      where: { name },
    });
  }
} finally {
  await prisma.$disconnect();
}
