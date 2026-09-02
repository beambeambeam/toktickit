import { fileURLToPath } from "node:url";

import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

const DEFAULT_ATTACHMENT_STORAGE_DIR = fileURLToPath(
  new URL("../../.data/attachments/", import.meta.url)
);

export const attachmentConfig = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnvStrict: {
    ATTACHMENT_STORAGE_DIR: process.env.ATTACHMENT_STORAGE_DIR,
  },
  server: {
    ATTACHMENT_STORAGE_DIR: z
      .string()
      .min(1)
      .default(DEFAULT_ATTACHMENT_STORAGE_DIR),
  },
});
