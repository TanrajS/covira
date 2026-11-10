// Storage drivers, kept free of `server-only` so the seed script can use them.
// App code should import from "./storage" instead.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

export interface StorageDriver {
  readonly name: "vercel-blob" | "local-disk";
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Returns the file body, or null if it no longer exists. */
  get(key: string): Promise<ReadableStream<Uint8Array> | Uint8Array<ArrayBuffer> | null>;
  remove(key: string): Promise<void>;
}

/** Vercel Blob — requires a PRIVATE store; files are only served through the app. */
const blobDriver: StorageDriver = {
  name: "vercel-blob",
  async put(key, data, contentType) {
    await put(key, data, { access: "private", contentType, addRandomSuffix: false });
  },
  async get(key) {
    const res = await get(key, { access: "private", useCache: false });
    return res && res.statusCode === 200 ? res.stream : null;
  },
  async remove(key) {
    await del(key).catch(() => undefined);
  },
};

function localDriver(): StorageDriver {
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "./storage");
  const resolveKey = (key: string) => {
    const full = path.resolve(/*turbopackIgnore: true*/ root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    return full;
  };
  return {
    name: "local-disk",
    async put(key, data) {
      const full = resolveKey(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, data);
    },
    async get(key) {
      return readFile(resolveKey(key)).then((b) => new Uint8Array(b)).catch(() => null);
    },
    async remove(key) {
      await unlink(resolveKey(key)).catch(() => undefined);
    },
  };
}

export function createStorage(): StorageDriver {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobDriver;
  if (process.env.VERCEL) {
    // Vercel's filesystem is read-only and not shared between instances.
    throw new Error("BLOB_READ_WRITE_TOKEN is not set. Connect a private Vercel Blob store to this project.");
  }
  return localDriver();
}
