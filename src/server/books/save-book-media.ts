import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  BOOK_IMAGES_SUBDIR,
  BOOK_VIDEO_POSTERS_SUBDIR,
  BOOK_VIDEOS_SUBDIR,
  UPLOAD_ROOT,
} from "@/server/env";
import { HttpError } from "@/server/http/http-error";

export const BOOK_MEDIA_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BOOK_MEDIA_VIDEO_MAX_BYTES = 150 * 1024 * 1024;
export const BOOK_MEDIA_POSTER_MAX_BYTES = 2 * 1024 * 1024;

const imageMime = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const videoMime = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const posterMime = new Set(["image/jpeg", "image/png", "image/webp"]);

export type SavedBookMainFile = {
  filename: string;
  mimetype: string;
  size: number;
};

export async function saveBookMainAndPoster(
  file: File,
  poster: File | null,
): Promise<{ main: SavedBookMainFile; posterFilename: string | null }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const mimetype = file.type || "application/octet-stream";

  if (!imageMime.has(mimetype) && !videoMime.has(mimetype)) {
    throw new HttpError(400, "지원하지 않는 파일 형식입니다.");
  }

  if (imageMime.has(mimetype) && buf.length > BOOK_MEDIA_IMAGE_MAX_BYTES) {
    throw new HttpError(400, "이미지가 너무 큽니다.");
  }
  if (videoMime.has(mimetype) && buf.length > BOOK_MEDIA_VIDEO_MAX_BYTES) {
    throw new HttpError(400, "동영상이 너무 큽니다.");
  }

  const dest = videoMime.has(mimetype)
    ? join(UPLOAD_ROOT, BOOK_VIDEOS_SUBDIR)
    : join(UPLOAD_ROOT, BOOK_IMAGES_SUBDIR);
  await mkdir(dest, { recursive: true });
  const ext = extname(file.name).toLowerCase() || (videoMime.has(mimetype) ? ".mp4" : ".jpg");
  const filename = `${randomUUID()}${ext}`;
  const path = join(dest, filename);
  await writeFile(path, buf);
  const main: SavedBookMainFile = { filename, mimetype, size: buf.length };

  let posterFilename: string | null = null;
  if (videoMime.has(mimetype)) {
    if (poster && poster.size > 0) {
      const pbuf = Buffer.from(await poster.arrayBuffer());
      const pm = poster.type || "";
      if (!posterMime.has(pm)) {
        throw new HttpError(400, "포스터는 JPEG, PNG, WebP만 가능합니다.");
      }
      if (pbuf.length > BOOK_MEDIA_POSTER_MAX_BYTES) {
        throw new HttpError(
          400,
          `포스터는 ${Math.floor(BOOK_MEDIA_POSTER_MAX_BYTES / (1024 * 1024))}MB 이하여야 합니다.`,
        );
      }
      const pdest = join(UPLOAD_ROOT, BOOK_VIDEO_POSTERS_SUBDIR);
      await mkdir(pdest, { recursive: true });
      const pext = extname(poster.name).toLowerCase() || ".jpg";
      posterFilename = `${randomUUID()}${pext}`;
      await writeFile(join(pdest, posterFilename), pbuf);
    }
  }

  return { main, posterFilename };
}
