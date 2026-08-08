import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

const DEFAULT_CORS_ORIGIN = "http://localhost:5173";

export const corsConfig = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnvStrict: {
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  },
  server: {
    CORS_ORIGIN: z.url().default(DEFAULT_CORS_ORIGIN),
  },
});
