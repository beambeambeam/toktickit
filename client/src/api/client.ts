import { env } from "@/env";
import { client } from "@/generated/hey-api/client.gen";

client.setConfig({ baseUrl: env.VITE_API_URL });

export { client as apiClient } from "@/generated/hey-api/client.gen";
