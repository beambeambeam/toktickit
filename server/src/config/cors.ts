import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

const DEFAULT_CORS_ORIGIN = "http://localhost:5173";
const DEFAULT_API_ORIGIN = "http://localhost:3000";

export const corsConfig = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnvStrict: {
    API_ORIGIN: process.env.API_ORIGIN,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  },
  server: {
    API_ORIGIN: z.url().default(DEFAULT_API_ORIGIN),
    CORS_ORIGIN: z.url().default(DEFAULT_CORS_ORIGIN),
  },
});
