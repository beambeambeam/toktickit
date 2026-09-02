import { prisma } from "../db/client.js";

export const findActiveDevelopmentRequesters = async () =>
  await prisma.developmentRequester.findMany({
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: {
      displayName: true,
      email: true,
      id: true,
    },
    where: { isActive: true },
  });

export const findActiveDevelopmentRequester = async (id: number) =>
  await prisma.developmentRequester.findFirst({
    select: {
      displayName: true,
      email: true,
      id: true,
    },
    where: { id, isActive: true },
  });
