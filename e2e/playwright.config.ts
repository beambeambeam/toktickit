import path from "node:path";

import { defineConfig } from "@playwright/test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const apiURL = process.env.E2E_API_URL ?? "http://localhost:3000";
const isCI = process.env.CI !== undefined && process.env.CI.length > 0;

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: isCI,
  fullyParallel: false,
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
  testDir: "lab-02",
  timeout: 60_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev",
      cwd: path.join(repositoryRoot, "server"),
      reuseExistingServer: !isCI,
      timeout: 120_000,
      url: `${apiURL}/api/health`,
    },
    {
      command: "pnpm dev",
      cwd: path.join(repositoryRoot, "client"),
      reuseExistingServer: !isCI,
      timeout: 120_000,
      url: baseURL,
    },
  ],
  workers: 1,
});
