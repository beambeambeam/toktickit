import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/lab-01/**/*.test.ts"],
  },
});
