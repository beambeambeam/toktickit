import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Page, TestInfo } from "@playwright/test";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const screenshotsRoot = path.resolve(
  repositoryRoot,
  "artifacts",
  "lab-03",
  "screenshots"
);
const evidenceCommand =
  "pnpm --filter @toktickit/e2e exec playwright test e2e/lab-03";

export type EvidenceStateSource =
  | "intercepted"
  | "natural"
  | "normalized"
  | "seeded";

export interface Lab3Capture {
  path: string;
  role: string;
  scenario: string;
  stateSource: EvidenceStateSource;
}

export interface Lab3Manifest {
  branch: string;
  command: string;
  commit: string;
  generatedAt: string;
  files: Lab3Capture[];
  project: string;
  sourceDirty: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isLab3Capture = (value: unknown): value is Lab3Capture =>
  isRecord(value) &&
  typeof value.path === "string" &&
  typeof value.role === "string" &&
  typeof value.scenario === "string" &&
  (value.stateSource === "intercepted" ||
    value.stateSource === "natural" ||
    value.stateSource === "normalized" ||
    value.stateSource === "seeded");

const isLab3Manifest = (value: unknown): value is Lab3Manifest =>
  isRecord(value) &&
  typeof value.branch === "string" &&
  typeof value.command === "string" &&
  typeof value.commit === "string" &&
  typeof value.generatedAt === "string" &&
  Array.isArray(value.files) &&
  value.files.every(isLab3Capture) &&
  typeof value.project === "string" &&
  typeof value.sourceDirty === "boolean";

const projectSlug = (projectName: string): string =>
  projectName.replaceAll(/[^a-z0-9]+/giu, "-").toLowerCase();

const manifestPath = (projectName: string): string =>
  path.resolve(screenshotsRoot, `manifest-${projectSlug(projectName)}.json`);

const repositoryValue = (args: readonly string[]): string => {
  try {
    return execFileSync("git", ["-C", repositoryRoot, ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
};

const repositorySourceIsDirty = (): boolean =>
  repositoryValue([
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ":(exclude)artifacts/lab-03/screenshots/**",
    ":(exclude)e2e/test-results/**",
    ":(exclude)e2e/playwright-report/**",
  ]).length > 0;

export const createLab3Manifest = (projectName: string): Lab3Manifest => ({
  branch: repositoryValue(["branch", "--show-current"]),
  command: evidenceCommand,
  commit: repositoryValue(["rev-parse", "HEAD"]),
  files: [],
  generatedAt: new Date().toISOString(),
  project: projectName,
  sourceDirty: repositorySourceIsDirty(),
});

export const resetLab3Manifests = async (): Promise<void> => {
  await mkdir(screenshotsRoot, { recursive: true });

  const projectNames = [
    "desktop-chromium",
    "tablet-chromium",
    "mobile-chromium",
  ];
  await Promise.all(
    projectNames.map(async (projectName) => {
      await writeFile(
        manifestPath(projectName),
        `${JSON.stringify(createLab3Manifest(projectName), null, 2)}\n`
      );
    })
  );
};

const readManifest = async (projectName: string): Promise<Lab3Manifest> => {
  try {
    const content = await readFile(manifestPath(projectName), "utf-8");
    const parsed: unknown = JSON.parse(content);

    if (isLab3Manifest(parsed)) {
      return parsed;
    }
  } catch {
    // The manifest is recreated below when a prior run is absent or invalid.
  }

  return createLab3Manifest(projectName);
};

export const captureLab3Evidence = async (
  page: Page,
  testInfo: TestInfo,
  capture: {
    directory: string;
    name: string;
    role: string;
    scenario: string;
    stateSource: EvidenceStateSource;
  }
): Promise<void> => {
  const projectName = testInfo.project.name;
  const filePath = path.resolve(
    screenshotsRoot,
    capture.directory,
    `${projectSlug(projectName)}-${capture.name}`
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  await page.screenshot({ fullPage: true, path: filePath });

  const manifest = await readManifest(projectName);
  const relativePath = path.relative(repositoryRoot, filePath);
  const entry: Lab3Capture = {
    path: relativePath,
    role: capture.role,
    scenario: capture.scenario,
    stateSource: capture.stateSource,
  };
  const existingIndex = manifest.files.findIndex(
    (file) => file.path === relativePath
  );

  if (existingIndex === -1) {
    manifest.files.push(entry);
  } else {
    manifest.files[existingIndex] = entry;
  }

  await writeFile(
    manifestPath(projectName),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
};
