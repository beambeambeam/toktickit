import { fileURLToPath, URL } from "node:url";

import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      routeFileIgnorePattern: "__test__",
      target: "react",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/lab-01/**/*.test.ts",
      "tests/lab-01/**/*.test.tsx",
      "tests/lab-02/**/*.test.ts",
      "tests/lab-02/**/*.test.tsx",
    ],
  },
});
