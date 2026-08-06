// @ts-check

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = fileURLToPath(new URL("..", import.meta.url));
const configPath = fileURLToPath(
  new URL("../openapi-ts.config.mjs", import.meta.url)
);
const generatedDirectory = fileURLToPath(
  new URL("../client/src/generated/hey-api", import.meta.url)
);
const expectedPath = await mkdtemp(path.join(tmpdir(), "toktickit-openapi-"));

/**
 * @param {string} directory Directory to scan.
 * @returns {Promise<string[]>} File paths under the directory.
 */
const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return await listFiles(entryPath);
      }

      return [entryPath];
    })
  );

  return files.flat();
};

/**
 * @param {string} directory Directory to read.
 * @returns {Promise<Map<string, string>>} File contents keyed by relative path.
 */
const readDirectory = async (directory) => {
  const files = await listFiles(directory);
  /** @type {Array<[string, string]>} */
  const entries = await Promise.all(
    files.map(async (file) => {
      const contents = await readFile(file, "utf-8");
      /** @type {[string, string]} */
      const fileEntry = [path.relative(directory, file), contents];
      return fileEntry;
    })
  );

  return new Map(entries);
};

try {
  execFileSync(
    "pnpm",
    [
      "exec",
      "openapi-ts",
      "--file",
      configPath,
      "--output",
      expectedPath,
      "--silent",
    ],
    { cwd: rootDirectory, stdio: "ignore" }
  );

  await stat(generatedDirectory);

  const [expected, generated] = await Promise.all([
    readDirectory(expectedPath),
    readDirectory(generatedDirectory),
  ]);

  /** @type {Set<string>} */
  const paths = new Set([...expected.keys(), ...generated.keys()]);
  /** @type {string[]} */
  const differences = [];

  for (const filePath of paths) {
    if (expected.get(filePath) !== generated.get(filePath)) {
      differences.push(filePath);
    }
  }

  if (differences.length > 0) {
    console.error(
      `Generated OpenAPI client is out of date: ${differences.join(", ")}. Run pnpm openapi:generate.`
    );
    process.exitCode = 1;
  }
} finally {
  await rm(expectedPath, { force: true, recursive: true });
}
