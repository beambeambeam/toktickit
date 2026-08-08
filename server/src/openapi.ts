import { readFileSync } from "node:fs";

import { parse } from "yaml";

const openapiFile = new URL("../openapi.yaml", import.meta.url);
const parsedOpenapiDocument = parse(
  readFileSync(openapiFile, "utf-8")
) as unknown;

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

if (!isJsonObject(parsedOpenapiDocument)) {
  throw new TypeError("OpenAPI document must be a YAML object");
}

export const openapiDocument = parsedOpenapiDocument;
