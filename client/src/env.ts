import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  client: {
    VITE_API_URL: z.url().default("http://localhost:3000"),
  },
  clientPrefix: "VITE_",
  emptyStringAsUndefined: true,
  runtimeEnvStrict: {
    VITE_API_URL: import.meta.env.VITE_API_URL,
  },
});
