import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const DEFAULT_DATABASE_URL =
  "postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public";

const getDatabaseUrl = (): string => {
  try {
    return env("DATABASE_URL");
  } catch {
    return DEFAULT_DATABASE_URL;
  }
};

export default defineConfig({
  datasource: {
    url: getDatabaseUrl(),
  },
  migrations: {
    path: "prisma/migrations",
  },
  schema: "prisma/schema.prisma",
});
