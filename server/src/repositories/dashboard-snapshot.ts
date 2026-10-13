import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";
import { getSevenDayWindow } from "../types/dashboard.js";

export interface DashboardWindow {
  from: Date;
  through: Date;
}

export interface DashboardSnapshot {
  generatedAt: Date;
  window: DashboardWindow;
}

// Tests pass `snapshotAt` to pin the window; production reads the database clock.
export const withDashboardSnapshot = async <T extends object>(
  snapshotAt: Date | undefined,
  read: (
    database: Prisma.TransactionClient,
    window: DashboardWindow
  ) => Promise<T>
): Promise<T & DashboardSnapshot> =>
  await prisma.$transaction(
    async (database) => {
      const [snapshot] = await database.$queryRaw<{ generatedAt: Date }[]>(
        Prisma.sql`SELECT transaction_timestamp() AS "generatedAt"`
      );
      if (snapshot === undefined) {
        throw new Error("The dashboard snapshot time is unavailable.");
      }

      const generatedAt = snapshotAt ?? snapshot.generatedAt;
      const window = getSevenDayWindow(generatedAt);

      return { ...(await read(database, window)), generatedAt, window };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
  );
