import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * File storage driver. Local disk for development; implement the same
 * interface against S3 / Azure Blob for production.
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const root = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "./storage");

function resolveKey(key: string) {
  const full = path.resolve(/*turbopackIgnore: true*/ root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export const storage: StorageDriver = {
  async put(key, data) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  },
  get: (key) => readFile(resolveKey(key)),
  async remove(key) {
    await unlink(resolveKey(key)).catch(() => undefined);
  },
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".msg": "application/vnd.ms-outlook",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function storageKeyFor(clientId: string, termYear: string, category: string, fileName: string) {
  const safe = fileName.replace(/[^\w.\- ]+/g, "_").slice(-120);
  return `${clientId}/${termYear}/${category}/${randomUUID()}-${safe}`;
}
