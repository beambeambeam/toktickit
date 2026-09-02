import "dotenv/config";
import { fileURLToPath } from "node:url";

import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;
const DEFAULT_ATTACHMENT_STORAGE_DIR = fileURLToPath(
  new URL("../.data/attachments/", import.meta.url)
);

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnvStrict: {
    ATTACHMENT_STORAGE_DIR: process.env.ATTACHMENT_STORAGE_DIR,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: process.env.PORT,
  },
  server: {
    ATTACHMENT_STORAGE_DIR: z
      .string()
      .min(1)
      .default(DEFAULT_ATTACHMENT_STORAGE_DIR),
    DATABASE_URL: z.url(),
    PORT: z.coerce.number().int().min(0).max(MAX_PORT).default(DEFAULT_PORT),
  },
});
