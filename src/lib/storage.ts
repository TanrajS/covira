import "server-only";
import { randomUUID } from "node:crypto";
import { createStorage, type StorageDriver } from "./storage-driver";

let instance: StorageDriver | undefined;
/** Lazily created so a missing token surfaces on first use, not at import. */
export const storage: StorageDriver = {
  get name() {
    return (instance ??= createStorage()).name;
  },
  put: (...a) => (instance ??= createStorage()).put(...a),
  get: (...a) => (instance ??= createStorage()).get(...a),
  remove: (...a) => (instance ??= createStorage()).remove(...a),
};

/**
 * Vercel functions reject request bodies over 4.5 MB, so uploads routed through
 * the app are capped there on Vercel. (Direct-to-Blob client uploads would lift
 * this; see README.)
 */
export const MAX_UPLOAD_BYTES = process.env.VERCEL ? 4.5 * 1024 * 1024 : 50 * 1024 * 1024;

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
