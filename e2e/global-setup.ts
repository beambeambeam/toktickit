import { execFileSync } from "node:child_process";
import path from "node:path";

import { resetLab3Manifests } from "./lab-03/evidence.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

const shouldResetLab3Manifests = (): boolean => {
  const requestedPaths = process.argv
    .slice(2)
    .filter((argument) => argument !== "--" && !argument.startsWith("-"));

  return (
    requestedPaths.length === 0 ||
    requestedPaths.some((argument) => argument.includes("lab-03"))
  );
};

export default async function globalSetup(): Promise<void> {
  execFileSync("pnpm", ["--filter", "@toktickit/server", "db:seed"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  execFileSync(
    "pnpm",
    ["--filter", "@toktickit/server", "exec", "tsx", "scripts/prepare-e2e.ts"],
    { cwd: repositoryRoot, stdio: "inherit" }
  );
  execFileSync(
    "pnpm",
    [
      "--filter",
      "@toktickit/server",
      "exec",
      "tsx",
      "scripts/reset-e2e-tickets.ts",
    ],
    { cwd: repositoryRoot, stdio: "inherit" }
  );
  if (shouldResetLab3Manifests()) {
    await resetLab3Manifests();
  }
}
