import { prisma } from "../db/client.js";

export const findRelatedSystems = async () =>
  await prisma.relatedSystem.findMany({
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
    },
    where: { isActive: true },
  });

export const findActiveRelatedSystem = async (id: number) =>
  await prisma.relatedSystem.findFirst({
    select: { id: true, name: true },
    where: { id, isActive: true },
  });
