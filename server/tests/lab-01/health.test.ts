import { strictEqual } from "node:assert";

import express from "express";
import type { ErrorRequestHandler } from "express";
import request from "supertest";
import { describe, it } from "vitest";

import { app } from "../../src/app.js";
import { apiErrorHandler } from "../../src/middlewares/api-errors.js";

const errorApiRouter = express.Router();

errorApiRouter.get("/error", (_request, _response, next) => {
  next(new Error("Something went wrong"));
});

errorApiRouter.get("/object-error", (_request, _response, next) => {
  next({ message: "Something went wrong" });
});

errorApiRouter.get("/fallback", (_request, _response, next) => {
  next({});
});

errorApiRouter.get("/headers-sent", (_request, response, next) => {
  response.write("partial");
  next(new Error("Something went wrong"));
});

const delegatedErrorHandler: ErrorRequestHandler = (
  _error,
  _request,
  response,
  next
) => {
  if (!response.headersSent) {
    next(new Error("Headers were not sent"));
    return;
  }

  response.end("delegated");
};

errorApiRouter.use(apiErrorHandler);
errorApiRouter.use(delegatedErrorHandler);

const errorApp = express();
errorApp.use("/api", errorApiRouter);

describe("Health API", () => {
  it("returns the documented health response without caching", async () => {
    await request(app)
      .get("/api/health")
      .expect("Content-Type", /json/u)
      .expect("Cache-Control", "no-store")
      .expect(200, {
        service: "TokTickIT API",
        status: "ok",
      });
  });

  it("allows the configured client origin", async () => {
    await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173")
      .expect("Access-Control-Allow-Origin", "http://localhost:5173")
      .expect(200);
  });

  it("does not allow a different origin", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "https://attacker.example")
      .expect(200);

    if (
      response.headers["access-control-allow-origin"] ===
        "https://attacker.example" ||
      response.headers["access-control-allow-origin"] === "*"
    ) {
      throw new Error("Disallowed origin received a CORS header");
    }
  });

  it("handles CORS preflight requests", async () => {
    await request(app)
      .options("/api/health")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "X-Not-Allowed")
      .expect("Access-Control-Allow-Origin", "http://localhost:5173")
      .expect("Access-Control-Allow-Headers", "Content-Type")
      .expect("Access-Control-Allow-Methods", /GET/u)
      .expect(204);
  });

  it("keeps CORS scoped to API routes", async () => {
    const documentationResponse = await request(app)
      .get("/openapi.json")
      .set("Origin", "http://localhost:5173")
      .expect(200);
    strictEqual(
      documentationResponse.headers["access-control-allow-origin"],
      undefined
    );

    const rootResponse = await request(app)
      .get("/")
      .set("Origin", "http://localhost:5173")
      .expect(404);
    strictEqual(rootResponse.headers["access-control-allow-origin"], undefined);
  });

  it("returns a JSON 404 for unknown API routes", async () => {
    await request(app)
      .get("/api/unknown")
      .expect("Content-Type", /json/u)
      .expect(404, { message: "Not Found" });
  });

  it("returns thrown error messages as JSON 500 responses", async () => {
    await request(errorApp)
      .get("/api/error")
      .expect("Content-Type", /json/u)
      .expect(500, { message: "Something went wrong" });
  });

  it("supports structural error messages and fallback messages", async () => {
    await request(errorApp)
      .get("/api/object-error")
      .expect(500, { message: "Something went wrong" });

    await request(errorApp)
      .get("/api/fallback")
      .expect(500, { message: "Internal Server Error" });
  });

  it("delegates errors when response headers were sent", async () => {
    await request(errorApp)
      .get("/api/headers-sent")
      .expect(200, "partialdelegated");
  });
});
