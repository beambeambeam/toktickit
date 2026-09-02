import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "../env.js";

const storagePath = (storageKey: string): string => {
  if (storageKey !== path.basename(storageKey) || storageKey.length === 0) {
    throw new Error("Invalid attachment storage key");
  }

  return path.join(env.ATTACHMENT_STORAGE_DIR, storageKey);
};

export const removeAttachmentFiles = async (
  storageKeys: readonly string[]
): Promise<void> => {
  await Promise.all(
    storageKeys.map(async (storageKey) => {
      try {
        await unlink(storagePath(storageKey));
      } catch {
        // Cleanup is best effort. The database/API ownership state remains authoritative.
      }
    })
  );
};

export const writeAttachmentFile = async (content: Buffer): Promise<string> => {
  await mkdir(env.ATTACHMENT_STORAGE_DIR, { recursive: true });
  const storageKey = randomUUID();

  try {
    await writeFile(storagePath(storageKey), content, { flag: "wx" });
    return storageKey;
  } catch (error: unknown) {
    await removeAttachmentFiles([storageKey]);
    throw error;
  }
};

export const readAttachmentFile = async (storageKey: string): Promise<Buffer> =>
  await readFile(storagePath(storageKey));
