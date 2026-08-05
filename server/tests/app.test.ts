import { describe, it } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";

void describe("Express app", () => {
  void it("returns not found for unknown routes", async () => {
    await request(app).get("/").expect(404);
  });
});
