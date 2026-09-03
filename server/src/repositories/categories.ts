import { prisma } from "../db/client.js";

export const findCategories = async () =>
  await prisma.category.findMany({
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
    },
    where: { isActive: true },
  });

export const findActiveCategory = async (id: number) =>
  await prisma.category.findFirst({
    select: { id: true, name: true },
    where: { id, isActive: true },
  });
