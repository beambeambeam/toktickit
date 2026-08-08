import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createClient } from "@hey-api/openapi-ts";
import request from "supertest";
import { parse } from "yaml";

import { app } from "../src/app.js";

type JsonObject = Record<string, unknown>;

const openapiPath = new URL("../openapi.yaml", import.meta.url);

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readOpenapiDocument = (): JsonObject => {
  const document = parse(
    readFileSync(fileURLToPath(openapiPath), "utf-8")
  ) as unknown;

  if (!isJsonObject(document)) {
    throw new TypeError("OpenAPI document must be a YAML object");
  }

  return document;
};

const requireJsonObject = (value: unknown): JsonObject => {
  if (!isJsonObject(value)) {
    throw new TypeError("Expected an object in the OpenAPI document");
  }

  return value;
};

void describe("OpenAPI contract", () => {
  void it("validates the canonical OpenAPI document", async () => {
    const document = readOpenapiDocument();

    assert.equal(document.openapi, "3.1.0");
    await createClient({
      dryRun: true,
      input: fileURLToPath(openapiPath),
      logs: { level: "silent" },
      output: path.join(tmpdir(), "toktickit-openapi-validation"),
    });
  });

  void it("documents the health response and reusable API error", () => {
    const document = readOpenapiDocument();
    const paths = requireJsonObject(document.paths);
    const healthPath = requireJsonObject(paths["/api/health"]);
    const getHealth = requireJsonObject(healthPath.get);
    const responses = requireJsonObject(getHealth.responses);
    const successResponse = requireJsonObject(responses["200"]);
    const successContent = requireJsonObject(successResponse.content);
    const successJson = requireJsonObject(successContent["application/json"]);
    const successSchema = requireJsonObject(successJson.schema);
    const successHeaders = requireJsonObject(successResponse.headers);
    const cacheControl = requireJsonObject(successHeaders["Cache-Control"]);
    const cacheControlSchema = requireJsonObject(cacheControl.schema);
    const { servers } = document;
    if (!Array.isArray(servers)) {
      throw new TypeError("OpenAPI servers must be an array");
    }

    const server = requireJsonObject(servers[0]);
    const components = requireJsonObject(document.components);
    const schemas = requireJsonObject(components.schemas);
    const healthSchema = requireJsonObject(schemas.HealthResponse);
    const errorSchema = requireJsonObject(schemas.ApiError);
    const errorResponse = requireJsonObject(responses["500"]);
    const errorContent = requireJsonObject(errorResponse.content);
    const errorJson = requireJsonObject(errorContent["application/json"]);
    const errorResponseSchema = requireJsonObject(errorJson.schema);

    assert.deepEqual(requireJsonObject(document.info), {
      description: "API contract for the TokTickIT service.",
      title: "TokTickIT API",
      version: "1.0.0",
    });
    assert.equal(server.url, "http://localhost:3000");
    assert.equal(successSchema.$ref, "#/components/schemas/HealthResponse");
    assert.deepEqual(cacheControlSchema, {
      const: "no-store",
      type: "string",
    });
    assert.deepEqual(healthSchema, {
      additionalProperties: false,
      properties: {
        service: { const: "TokTickIT API", type: "string" },
        status: { const: "ok", type: "string" },
      },
      required: ["status", "service"],
      type: "object",
    });
    assert.deepEqual(errorSchema, {
      additionalProperties: false,
      example: { message: "Example error message" },
      properties: {
        message: { type: "string" },
      },
      required: ["message"],
      type: "object",
    });
    assert.equal(errorResponseSchema.$ref, "#/components/schemas/ApiError");
  });

  void it("documents the populated Category list response", () => {
    const document = readOpenapiDocument();
    const paths = requireJsonObject(document.paths);
    const categoriesPath = requireJsonObject(paths["/api/categories"]);
    const getCategories = requireJsonObject(categoriesPath.get);
    const responses = requireJsonObject(getCategories.responses);
    const successResponse = requireJsonObject(responses["200"]);
    const successContent = requireJsonObject(successResponse.content);
    const successJson = requireJsonObject(successContent["application/json"]);
    const successSchema = requireJsonObject(successJson.schema);
    const items = requireJsonObject(successSchema.items);
    const components = requireJsonObject(document.components);
    const schemas = requireJsonObject(components.schemas);
    const categorySchema = requireJsonObject(schemas.Category);

    assert.equal(getCategories.operationId, "getApiCategories");
    assert.equal(successSchema.type, "array");
    assert.equal(items.$ref, "#/components/schemas/Category");
    assert.deepEqual(successJson.example, [
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
    ]);
    assert.deepEqual(categorySchema, {
      additionalProperties: false,
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
      },
      required: ["id", "name"],
      type: "object",
    });
  });

  void it("serves the canonical document as JSON", async () => {
    const response = await request(app).get("/openapi.json").expect(200);

    assert.match(response.headers["content-type"], /application\/json/u);
    assert.deepEqual(response.body, readOpenapiDocument());
  });

  void it("serves interactive documentation and its assets", async () => {
    const documentation = await request(app).get("/docs").expect(200);

    assert.match(documentation.headers["content-type"], /html/u);
    assert.match(documentation.text, /swagger-ui/u);
    assert.match(documentation.text, /<base href="\/docs\/">/u);

    await request(app).get("/docs/swagger-ui.css").expect(200);
    await request(app).get("/docs/swagger-ui-bundle.js").expect(200);
  });
});
