import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;
export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnvStrict: {
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: process.env.PORT,
  },
  server: {
    DATABASE_URL: z.url(),
    PORT: z.coerce.number().int().min(0).max(MAX_PORT).default(DEFAULT_PORT),
  },
});
