import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { attachmentConfig } from "../config/attachments.js";

const storagePath = (storageKey: string): string => {
  if (storageKey !== path.basename(storageKey) || storageKey.length === 0) {
    throw new Error("Invalid Attachment storage key");
  }

  return path.join(attachmentConfig.ATTACHMENT_STORAGE_DIR, storageKey);
};

export const removeAttachmentFiles = async (
  storageKeys: readonly string[]
): Promise<void> => {
  const failures: unknown[] = [];

  await Promise.all(
    storageKeys.map(async (storageKey) => {
      try {
        await unlink(storagePath(storageKey));
      } catch (error: unknown) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return;
        }

        failures.push(error);
      }
    })
  );

  if (failures.length > 0) {
    throw new Error("Unable to clean up Attachment storage", {
      cause: failures[0],
    });
  }
};

export const writeAttachmentFile = async (content: Buffer): Promise<string> => {
  await mkdir(attachmentConfig.ATTACHMENT_STORAGE_DIR, { recursive: true });
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
