import { prisma } from "../db/client.js";

export const findCategories = async () =>
  await prisma.category.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
