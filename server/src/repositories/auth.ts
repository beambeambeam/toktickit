import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";

export const publicUserSelection = {
  createdAt: true,
  displayName: true,
  email: true,
  id: true,
  isActive: true,
  mustChangePassword: true,
  role: true,
  updatedAt: true,
} as const;

export const authUserSelection = {
  ...publicUserSelection,
  passwordHash: true,
} as const;

export const findUserByEmail = async (email: string) =>
  await prisma.user.findUnique({
    select: authUserSelection,
    where: { email },
  });

export const findUserById = async (id: number) =>
  await prisma.user.findUnique({
    select: authUserSelection,
    where: { id },
  });

export const findSessionByTokenHash = async (tokenHash: string) =>
  await prisma.session.findUnique({
    include: { user: { select: authUserSelection } },
    where: { tokenHash },
  });

export const deleteSessionByTokenHash = async (tokenHash: string) =>
  await prisma.session.deleteMany({ where: { tokenHash } });

export const deleteSessionById = async (id: string) =>
  await prisma.session.deleteMany({ where: { id } });

export const updateSessionLastSeen = async (id: string, lastSeenAt: Date) =>
  await prisma.session.updateMany({
    data: { lastSeenAt },
    where: { id },
  });

export const deleteSessionsForUser = async (
  database: Prisma.TransactionClient,
  userId: number
) => await database.session.deleteMany({ where: { userId } });

interface SessionRecordInput {
  absoluteExpiresAt: Date;
  createdAt?: Date;
  csrfSecret: string;
  id: string;
  lastSeenAt?: Date;
  restricted: boolean;
  tokenHash: string;
  userId: number;
}

interface SessionRotationInput extends SessionRecordInput {
  previousTokenHash?: string;
}

const createSessionRecord = async (
  database: Prisma.TransactionClient,
  input: SessionRecordInput
) =>
  await database.session.create({
    data: {
      absoluteExpiresAt: input.absoluteExpiresAt,
      ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
      csrfSecret: input.csrfSecret,
      id: input.id,
      ...(input.lastSeenAt === undefined
        ? {}
        : { lastSeenAt: input.lastSeenAt }),
      restricted: input.restricted,
      tokenHash: input.tokenHash,
      userId: input.userId,
    },
    include: { user: { select: authUserSelection } },
  });

export const createSessionWithPrevious = async ({
  previousTokenHash,
  ...input
}: SessionRotationInput) =>
  await prisma.$transaction(async (database) => {
    if (previousTokenHash !== undefined) {
      await database.session.deleteMany({
        where: { tokenHash: previousTokenHash },
      });
    }

    return await createSessionRecord(database, input);
  });

interface PasswordAndSessionReplacementInput extends SessionRecordInput {
  newPasswordHash: string;
  sessionId: string;
  currentPasswordHash: string;
}

export const replacePasswordAndSessions = async (
  input: PasswordAndSessionReplacementInput
) =>
  await prisma.$transaction(async (database) => {
    const currentSession = await database.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT "id" FROM "Session" WHERE "id" = ${input.sessionId} AND "userId" = ${input.userId} FOR UPDATE`
    );

    if (currentSession.length !== 1) {
      return null;
    }

    const updated = await database.user.updateMany({
      data: { mustChangePassword: false, passwordHash: input.newPasswordHash },
      where: {
        id: input.userId,
        isActive: true,
        passwordHash: input.currentPasswordHash,
      },
    });

    if (updated.count !== 1) {
      return null;
    }

    await deleteSessionsForUser(database, input.userId);
    return await createSessionRecord(database, {
      absoluteExpiresAt: input.absoluteExpiresAt,
      csrfSecret: input.csrfSecret,
      id: input.id,
      lastSeenAt: new Date(),
      restricted: input.restricted,
      tokenHash: input.tokenHash,
      userId: input.userId,
    });
  });

export const createLoginAttemptReservations = async (input: {
  accountKey?: string;
  ipKey: string;
  now: Date;
}) => {
  const keys = [input.ipKey, input.accountKey].filter(
    (key): key is string => key !== undefined
  );
  keys.sort();
  const cutoff = new Date(input.now.getTime() - 15 * 60 * 1000);

  return await prisma.$transaction(async (database) => {
    for (const key of keys) {
      // Advisory locks must be acquired in a stable order within the transaction.
      // oxlint-disable-next-line no-await-in-loop
      await database.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS lock`
      );
    }

    await database.loginAttempt.deleteMany({
      where: { failedAt: { lt: cutoff }, key: { in: keys } },
    });

    const limits: { key: string; maximum: number }[] = [
      { key: input.ipKey, maximum: 30 },
    ];
    if (input.accountKey !== undefined) {
      limits.push({ key: input.accountKey, maximum: 5 });
    }

    let retryAfter = 0;
    for (const limit of limits) {
      // Each limit is checked while its advisory lock is held.
      // oxlint-disable-next-line no-await-in-loop
      const count = await database.loginAttempt.count({
        where: { failedAt: { gte: cutoff }, key: limit.key },
      });

      if (count >= limit.maximum) {
        // The oldest attempt determines the retry boundary for this key.
        // oxlint-disable-next-line no-await-in-loop
        const oldest = await database.loginAttempt.findFirst({
          orderBy: { failedAt: "asc" },
          select: { failedAt: true },
          where: { failedAt: { gte: cutoff }, key: limit.key },
        });
        const waitMilliseconds =
          (oldest?.failedAt.getTime() ?? input.now.getTime()) +
          15 * 60 * 1000 -
          input.now.getTime();
        retryAfter = Math.max(
          retryAfter,
          Math.max(1, Math.ceil(waitMilliseconds / 1000))
        );
      }
    }

    if (retryAfter > 0) {
      return { reservationIds: [], retryAfter };
    }

    const reservationIds: number[] = [];
    for (const key of keys) {
      // Keep reservation creation in the same deterministic key order.
      // oxlint-disable-next-line no-await-in-loop
      const attempt = await database.loginAttempt.create({
        data: { failedAt: input.now, key },
        select: { id: true },
      });
      reservationIds.push(attempt.id);
    }

    return { reservationIds, retryAfter: 0 };
  });
};

export const releaseLoginAttemptReservations = async (
  reservationIds: readonly number[]
) => {
  if (reservationIds.length === 0) {
    return;
  }

  await prisma.loginAttempt.deleteMany({
    where: { id: { in: [...reservationIds] } },
  });
};
