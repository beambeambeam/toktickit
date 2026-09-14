import { prisma } from "../db/client.js";
import { UserEmailConflictError } from "../errors/user-errors.js";
import { Prisma } from "../generated/prisma/client.js";
import type { UserListQuery, UserRoleValue } from "../types/users.js";
import { publicUserSelection } from "./auth.js";

const escapeLikePattern = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

export const findUsers = async ({ role, search }: UserListQuery) => {
  const where: Prisma.UserWhereInput = {};

  if (role !== undefined) {
    where.role = role;
  }

  if (search !== undefined) {
    const literalSearch = escapeLikePattern(search);
    where.OR = [
      { displayName: { contains: literalSearch, mode: "insensitive" } },
      { email: { contains: literalSearch, mode: "insensitive" } },
    ];
  }

  return await prisma.user.findMany({
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: publicUserSelection,
    where,
  });
};

export const createUser = async (input: {
  displayName: string;
  email: string;
  initialPasswordHash: string;
  isActive: boolean;
  role: UserRoleValue;
}) => {
  try {
    return await prisma.user.create({
      data: {
        displayName: input.displayName,
        email: input.email,
        isActive: input.isActive,
        mustChangePassword: true,
        passwordHash: input.initialPasswordHash,
        role: input.role,
      },
      select: publicUserSelection,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new UserEmailConflictError();
    }

    throw error;
  }
};
