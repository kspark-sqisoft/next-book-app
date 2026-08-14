// 북 에디터 업로드: 이미지·동영상·포스터를 디스크에 저장
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import {
  BOOK_IMAGES_SUBDIR,
  BOOK_VIDEO_POSTERS_SUBDIR,
  BOOK_VIDEOS_SUBDIR,
  UPLOAD_ROOT,
} from "@/server/env";
import { HttpError } from "@/server/http/http-error";
import { tryUnlink } from "@/server/uploads/write-file";

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
  const mimetype = file.type || "application/octet-stream";

  // ── 본 파일·포스터 검증을 전부 디스크 기록 앞에서 끝낸다 (크기는 힙 적재 전 선차단) ──
  if (!imageMime.has(mimetype) && !videoMime.has(mimetype)) {
    throw new HttpError(400, "지원하지 않는 파일 형식입니다.");
  }
  if (imageMime.has(mimetype) && file.size > BOOK_MEDIA_IMAGE_MAX_BYTES) {
    throw new HttpError(400, "이미지가 너무 큽니다.");
  }
  if (videoMime.has(mimetype) && file.size > BOOK_MEDIA_VIDEO_MAX_BYTES) {
    throw new HttpError(400, "동영상이 너무 큽니다.");
  }
  const hasPoster =
    videoMime.has(mimetype) && poster != null && poster.size > 0;
  if (hasPoster) {
    const pm = poster.type || "";
    if (!posterMime.has(pm)) {
      throw new HttpError(400, "포스터는 JPEG, PNG, WebP만 가능합니다.");
    }
    if (poster.size > BOOK_MEDIA_POSTER_MAX_BYTES) {
      throw new HttpError(
        400,
        `포스터는 ${Math.floor(BOOK_MEDIA_POSTER_MAX_BYTES / (1024 * 1024))}MB 이하여야 합니다.`,
      );
    }
  }

  const buf = Buffer.from(await file.arrayBuffer());
  // file.size는 클라이언트 신고값 — 실제 바이트 수로 한 번 더 확인
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
  const ext =
    extname(file.name).toLowerCase() ||
    (videoMime.has(mimetype) ? ".mp4" : ".jpg");
  const filename = `${randomUUID()}${ext}`;
  const path = join(dest, filename);
  await writeFile(path, buf);
  const main: SavedBookMainFile = { filename, mimetype, size: buf.length };

  let posterFilename: string | null = null;
  if (hasPoster) {
    try {
      const pbuf = Buffer.from(await poster.arrayBuffer());
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
    } catch (e) {
      // 포스터 저장 실패 시 이미 기록한 본 영상(최대 150MB)이 고아로 남지 않게 롤백
      await tryUnlink(path);
      throw e;
    }
  }

  return { main, posterFilename };
}
