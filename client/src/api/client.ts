import { env } from "@/env";
import { client } from "@/generated/hey-api/client.gen";

export class ApiConnectionError extends Error {
  constructor(cause: unknown) {
    super("Unable to connect to TokTickIT API", { cause });
    this.name = "ApiConnectionError";
  }
}

const fetchWithConnectionError: typeof fetch = async (...args) => {
  try {
    return await globalThis.fetch(...args);
  } catch (error: unknown) {
    throw new ApiConnectionError(error);
  }
};

client.setConfig({
  baseUrl: env.VITE_API_URL,
  fetch: fetchWithConnectionError,
});

export { client as apiClient } from "@/generated/hey-api/client.gen";
