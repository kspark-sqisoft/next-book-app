import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import {
  POST_IMAGES_SUBDIR,
  POST_VIDEO_POSTERS_SUBDIR,
  POST_VIDEOS_SUBDIR,
  UPLOAD_ROOT,
} from "@/server/env";
import { HttpError } from "@/server/http/http-error";
import {
  POST_ATTACHMENTS_MAX_COUNT,
  POST_MEDIA_IMAGE_MAX_BYTES,
  POST_MEDIA_POSTER_MAX_BYTES,
  POST_MEDIA_VIDEO_MAX_BYTES,
} from "@/server/posts/post-upload-constants";
import type { UploadedPostFile } from "@/server/services/posts.service";

const imageMime = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const videoMime = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const posterMime = new Set(["image/jpeg", "image/png", "image/webp"]);

async function writeBuffer(
  destDir: string,
  buf: Buffer,
  originalName: string,
  fallbackExt: string,
): Promise<UploadedPostFile> {
  await mkdir(destDir, { recursive: true });
  const ext = extname(originalName).toLowerCase() || fallbackExt;
  const filename = `${randomUUID()}${ext}`;
  const path = join(destDir, filename);
  await writeFile(path, buf);
  return {
    filename,
    mimetype: "application/octet-stream",
    size: buf.length,
  };
}

async function saveAttachmentLike(
  file: File,
  isPosterField: boolean,
): Promise<UploadedPostFile> {
  const buf = Buffer.from(await file.arrayBuffer());
  const mimetype = file.type || "application/octet-stream";

  if (isPosterField) {
    if (!posterMime.has(mimetype)) {
      throw new HttpError(400, "동영상 썸네일은 JPEG, PNG, WebP만 가능합니다.");
    }
    if (buf.length > POST_MEDIA_POSTER_MAX_BYTES) {
      throw new HttpError(400, "동영상 썸네일은 파일당 2MB 이하여야 합니다.");
    }
    const dest = join(UPLOAD_ROOT, POST_VIDEO_POSTERS_SUBDIR);
    const out = await writeBuffer(dest, buf, file.name, ".jpg");
    return { ...out, mimetype };
  }

  if (!imageMime.has(mimetype) && !videoMime.has(mimetype)) {
    throw new HttpError(
      400,
      "첨부는 이미지(JPEG/PNG/GIF/WebP) 또는 동영상(MP4/WebM/MOV)만 가능합니다.",
    );
  }
  if (imageMime.has(mimetype) && buf.length > POST_MEDIA_IMAGE_MAX_BYTES) {
    throw new HttpError(400, "이미지 첨부는 파일당 5MB 이하여야 합니다.");
  }
  if (videoMime.has(mimetype) && buf.length > POST_MEDIA_VIDEO_MAX_BYTES) {
    throw new HttpError(400, "동영상 첨부가 너무 큽니다.");
  }

  const dest = imageMime.has(mimetype)
    ? join(UPLOAD_ROOT, POST_IMAGES_SUBDIR)
    : join(UPLOAD_ROOT, POST_VIDEOS_SUBDIR);
  const fallback = videoMime.has(mimetype) ? ".mp4" : ".jpg";
  const out = await writeBuffer(dest, buf, file.name, fallback);
  return { ...out, mimetype };
}

export async function parsePostCreateMultipart(formData: FormData): Promise<{
  title: string;
  content: string;
  category?: string;
  attachmentFiles: UploadedPostFile[];
  posterFiles: UploadedPostFile[];
}> {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "");
  const cat = formData.get("category");
  const category =
    cat != null && String(cat).trim() !== "" ? String(cat) : undefined;

  const rawAtt = formData
    .getAll("attachments")
    .filter((x): x is File => x instanceof File && x.size > 0);
  const rawPosters = formData
    .getAll("posters")
    .filter((x): x is File => x instanceof File && x.size > 0);

  if (rawAtt.length > POST_ATTACHMENTS_MAX_COUNT) {
    throw new HttpError(
      400,
      `첨부는 최대 ${POST_ATTACHMENTS_MAX_COUNT}개까지 가능합니다.`,
    );
  }

  const attachmentFiles: UploadedPostFile[] = [];
  for (const f of rawAtt) {
    attachmentFiles.push(await saveAttachmentLike(f, false));
  }

  const posterFiles: UploadedPostFile[] = [];
  for (const f of rawPosters) {
    posterFiles.push(await saveAttachmentLike(f, true));
  }

  return { title, content, category, attachmentFiles, posterFiles };
}

export async function parsePostPatchMultipart(formData: FormData): Promise<{
  title?: string;
  content?: string;
  category?: string;
  mediaPlanRaw?: string;
  removeMedia?: boolean;
  newFiles: UploadedPostFile[];
  newPosters: UploadedPostFile[];
}> {
  const titleF = formData.get("title");
  const contentF = formData.get("content");
  const categoryF = formData.get("category");
  const mediaPlanRawF = formData.get("mediaPlan");
  const removeMedia =
    formData.get("removeMedia") === "1" ||
    formData.get("removeMedia") === "true" ||
    formData.get("removeMedia") === "on" ||
    formData.get("removeImage") === "1" ||
    formData.get("removeImage") === "true" ||
    formData.get("removeImage") === "on" ||
    formData.get("removeVideo") === "1" ||
    formData.get("removeVideo") === "true" ||
    formData.get("removeVideo") === "on";

  const title =
    titleF != null && String(titleF).trim() !== ""
      ? String(titleF).trim()
      : undefined;
  const content = contentF != null ? String(contentF) : undefined;
  const category =
    categoryF != null && String(categoryF).trim() !== ""
      ? String(categoryF)
      : undefined;
  const mediaPlanRaw =
    mediaPlanRawF != null && String(mediaPlanRawF).trim() !== ""
      ? String(mediaPlanRawF).trim()
      : undefined;

  const rawNew = formData
    .getAll("newFiles")
    .filter((x): x is File => x instanceof File && x.size > 0);
  const rawPosters = formData
    .getAll("newPosters")
    .filter((x): x is File => x instanceof File && x.size > 0);

  if (rawNew.length > POST_ATTACHMENTS_MAX_COUNT) {
    throw new HttpError(
      400,
      `첨부는 최대 ${POST_ATTACHMENTS_MAX_COUNT}개까지 가능합니다.`,
    );
  }

  const newFiles: UploadedPostFile[] = [];
  for (const f of rawNew) {
    newFiles.push(await saveAttachmentLike(f, false));
  }

  const newPosters: UploadedPostFile[] = [];
  for (const f of rawPosters) {
    newPosters.push(await saveAttachmentLike(f, true));
  }

  return {
    title,
    content,
    category,
    mediaPlanRaw,
    removeMedia: removeMedia || undefined,
    newFiles,
    newPosters,
  };
}
