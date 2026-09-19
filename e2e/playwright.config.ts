import path from "node:path";

import { defineConfig } from "@playwright/test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const clientPort = process.env.E2E_CLIENT_PORT ?? "5173";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${clientPort}`;
const apiURL = process.env.E2E_API_URL ?? "http://localhost:3000";
const isCI = process.env.CI !== undefined && process.env.CI.length > 0;

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: isCI,
  fullyParallel: false,
  globalSetup: "./global-setup.ts",
  outputDir: "test-results",
  projects: [
    {
      name: "desktop-chromium",
      use: { viewport: { height: 900, width: 1440 } },
    },
    {
      name: "tablet-chromium",
      use: { viewport: { height: 1024, width: 768 } },
    },
    {
      name: "mobile-chromium",
      use: {
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      },
    },
  ],
  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  retries: isCI ? 2 : 0,
  testDir: ".",
  timeout: 60_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: `CORS_ORIGIN=${baseURL} API_ORIGIN=${apiURL} pnpm dev`,
      cwd: path.join(repositoryRoot, "server"),
      reuseExistingServer: !isCI,
      timeout: 120_000,
      url: `${apiURL}/api/health`,
    },
    {
      command: `VITE_SHOW_ROUTER_DEVTOOLS=false pnpm dev --host 127.0.0.1 --port ${clientPort}`,
      cwd: path.join(repositoryRoot, "client"),
      reuseExistingServer: !isCI,
      timeout: 120_000,
      url: baseURL,
    },
  ],
  workers: 1,
});
