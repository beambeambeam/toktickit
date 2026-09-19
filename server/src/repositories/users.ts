import { prisma } from "../db/client.js";
import { UserEmailConflictError } from "../errors/user-errors.js";
import { Prisma } from "../generated/prisma/client.js";
import type { UserListQuery, UserRoleValue } from "../types/users.js";
import { deleteSessionsForUser, publicUserSelection } from "./auth.js";

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

export const findUserById = async (id: number) =>
  await prisma.user.findUnique({
    select: publicUserSelection,
    where: { id },
  });

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

type UserDatabase = Prisma.TransactionClient;
type UserRecord = Prisma.UserGetPayload<{
  select: typeof publicUserSelection;
}>;

export type UserLifecycleOutcome =
  | { kind: "forbidden" }
  | { kind: "last-admin" }
  | { kind: "not-found" }
  | { kind: "self-deactivation" }
  | { kind: "success"; sessionRevoked: boolean; user: UserRecord };

const ACCOUNT_LIFECYCLE_LOCK_KEY = "toktickit:user-account-lifecycle";
const terminalStatuses = ["Resolved", "Closed", "Cancelled"] as const;

const lockAccountLifecycle = async (database: UserDatabase) => {
  await database.$queryRaw(
    Prisma.sql`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${ACCOUNT_LIFECYCLE_LOCK_KEY}, 0))) AS lock`
  );
};

const lockUser = async (database: UserDatabase, userId: number) => {
  await database.$queryRaw(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
  );
};

const lockNonterminalTicketsOwnedBy = async (
  database: UserDatabase,
  userId: number
) => {
  await database.$queryRaw(
    Prisma.sql`
      SELECT "id"
      FROM "Ticket"
      WHERE "ownerId" = ${userId}
        AND "currentStatus" NOT IN ('Resolved', 'Closed', 'Cancelled')
      ORDER BY "id"
      FOR UPDATE
    `
  );
};

const isEligibleOwner = (user: {
  isActive: boolean;
  role: UserRoleValue;
}): boolean =>
  user.isActive && (user.role === "ITStaff" || user.role === "Administrator");

const getLockedActorAndTarget = async (
  database: UserDatabase,
  actorId: number,
  targetId: number
) => {
  const ids = [actorId];
  if (actorId !== targetId) {
    ids.push(targetId);
    if (actorId > targetId) {
      ids.reverse();
    }
  }
  for (const id of ids) {
    // Lock account rows in ID order after the shared lifecycle lock.
    // oxlint-disable-next-line no-await-in-loop
    await lockUser(database, id);
  }

  const [actor, target] = await Promise.all([
    database.user.findUnique({
      select: { isActive: true, mustChangePassword: true, role: true },
      where: { id: actorId },
    }),
    database.user.findUnique({
      select: publicUserSelection,
      where: { id: targetId },
    }),
  ]);

  return { actor, target };
};

const hasAuthority = (
  actor: {
    isActive: boolean;
    mustChangePassword: boolean;
    role: UserRoleValue;
  } | null
): boolean =>
  actor !== null &&
  actor.isActive &&
  !actor.mustChangePassword &&
  actor.role === "Administrator";

const losesAdministratorSafety = (
  target: UserRecord,
  nextRole: UserRoleValue,
  nextIsActive: boolean
): boolean =>
  target.role === "Administrator" &&
  target.isActive &&
  (nextRole !== "Administrator" || !nextIsActive);

const losesOwnerEligibility = (
  target: UserRecord,
  nextRole: UserRoleValue,
  nextIsActive: boolean
): boolean =>
  isEligibleOwner(target) &&
  !isEligibleOwner({ isActive: nextIsActive, role: nextRole });

export const updateUserAccount = async (input: {
  actorId: number;
  targetId: number;
  changes: {
    displayName?: string;
    email?: string;
    isActive?: boolean;
    role?: UserRoleValue;
  };
}): Promise<UserLifecycleOutcome> => {
  try {
    return await prisma.$transaction(async (database) => {
      await lockAccountLifecycle(database);
      const { actor, target } = await getLockedActorAndTarget(
        database,
        input.actorId,
        input.targetId
      );

      if (!hasAuthority(actor)) {
        return { kind: "forbidden" };
      }

      if (target === null) {
        return { kind: "not-found" };
      }

      if (target.id === input.actorId && input.changes.isActive === false) {
        return { kind: "self-deactivation" };
      }

      const nextRole = input.changes.role ?? target.role;
      const nextIsActive = input.changes.isActive ?? target.isActive;

      if (losesAdministratorSafety(target, nextRole, nextIsActive)) {
        const activeAdministratorCount = await database.user.count({
          where: { isActive: true, role: "Administrator" },
        });

        if (activeAdministratorCount <= 1) {
          return { kind: "last-admin" };
        }
      }

      const sessionRevoked = target.role !== nextRole || !nextIsActive;
      const eligibilityLost = losesOwnerEligibility(
        target,
        nextRole,
        nextIsActive
      );
      const now = new Date();

      if (eligibilityLost) {
        await lockNonterminalTicketsOwnedBy(database, target.id);
      }

      const user = await database.user.update({
        data: input.changes,
        select: publicUserSelection,
        where: { id: target.id },
      });

      if (sessionRevoked) {
        await deleteSessionsForUser(database, target.id);
      }

      if (eligibilityLost) {
        await database.ticket.updateMany({
          data: {
            ownerId: null,
            updatedAt: now,
            version: { increment: 1 },
          },
          where: {
            currentStatus: { notIn: [...terminalStatuses] },
            ownerId: target.id,
          },
        });
      }

      return {
        kind: "success",
        sessionRevoked,
        user,
      };
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

export type ResetPasswordOutcome =
  | { kind: "forbidden" }
  | { kind: "not-found" }
  | { kind: "success"; sessionRevoked: true; user: UserRecord };

export const resetUserInitialPassword = async (input: {
  actorId: number;
  initialPasswordHash: string;
  targetId: number;
}): Promise<ResetPasswordOutcome> =>
  await prisma.$transaction(async (database) => {
    await lockAccountLifecycle(database);
    const { actor, target } = await getLockedActorAndTarget(
      database,
      input.actorId,
      input.targetId
    );

    if (!hasAuthority(actor)) {
      return { kind: "forbidden" };
    }

    if (target === null) {
      return { kind: "not-found" };
    }

    const user = await database.user.update({
      data: {
        mustChangePassword: true,
        passwordHash: input.initialPasswordHash,
      },
      select: publicUserSelection,
      where: { id: target.id },
    });
    await deleteSessionsForUser(database, target.id);

    return { kind: "success", sessionRevoked: true, user };
  });
