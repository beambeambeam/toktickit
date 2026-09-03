import { execFileSync } from "node:child_process";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

export default function globalSetup(): void {
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
}
