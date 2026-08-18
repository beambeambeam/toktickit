import request from "supertest";
import { describe, it } from "vitest";

import { app } from "../../src/app.js";

describe("Express app", () => {
  it("returns not found for unknown routes", async () => {
    await request(app).get("/").expect(404);
  });
});
