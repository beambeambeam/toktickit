import { readFile } from "node:fs/promises";

import openapiTS from "openapi-typescript";

const openapiPath = new URL("../server/openapi.yaml", import.meta.url);
const generatedTypesPath = new URL(
  "../client/src/generated/openapi.ts",
  import.meta.url
);

const [expected, generated] = await Promise.all([
  openapiTS(openapiPath),
  readFile(generatedTypesPath, "utf-8"),
]);

if (expected.trimEnd() !== generated.trimEnd()) {
  console.error(
    "Generated OpenAPI types are out of date. Run pnpm openapi:generate."
  );
  process.exitCode = 1;
}
