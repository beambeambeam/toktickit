import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 60_000,
    include: [
      "tests/lab-01/**/*.test.ts",
      "tests/lab-02/**/*.test.ts",
      "tests/lab-03/**/*.test.ts",
    ],
  },
});
