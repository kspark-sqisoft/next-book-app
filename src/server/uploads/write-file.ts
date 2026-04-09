import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extname } from "node:path";

export type SavedDiskFile = {
  filename: string;
  path: string;
  mimetype: string;
  size: number;
};

export async function saveFormFileToDir(options: {
  file: File;
  destDir: string;
  maxBytes: number;
  allowedMime: Set<string>;
  fallbackExt: string;
}): Promise<SavedDiskFile> {
  const { file, destDir, maxBytes, allowedMime, fallbackExt } = options;
  const mimetype = file.type || "application/octet-stream";
  if (!allowedMime.has(mimetype)) {
    throw new Error("MIME_NOT_ALLOWED");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > maxBytes) {
    throw new Error("FILE_TOO_LARGE");
  }
  await mkdir(destDir, { recursive: true });
  const orig = file.name || "";
  const ext = extname(orig).toLowerCase() || fallbackExt;
  const filename = `${randomUUID()}${ext}`;
  const path = join(destDir, filename);
  await writeFile(path, buf);
  return { filename, path, mimetype, size: buf.length };
}

export async function tryUnlink(path: string): Promise<void> {
  await unlink(path).catch(() => undefined);
}
