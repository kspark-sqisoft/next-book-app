import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extname } from "node:path";

// 디스크 저장 결과(웹 공개 URL은 호출 측에서 SUBDIR과 조합)
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
    throw new Error("MIME_NOT_ALLOWED"); // 액션에서 메시지로 변환
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > maxBytes) {
    throw new Error("FILE_TOO_LARGE");
  }
  await mkdir(destDir, { recursive: true });
  const orig = file.name || "";
  const ext = extname(orig).toLowerCase() || fallbackExt; // 원본 확장 없으면 fallback
  const filename = `${randomUUID()}${ext}`; // 추측 불가 파일명
  const path = join(destDir, filename);
  await writeFile(path, buf);
  return { filename, path, mimetype, size: buf.length };
}

// 롤백·교체 시 베스트 에포트 삭제
export async function tryUnlink(path: string): Promise<void> {
  await unlink(path).catch(() => undefined);
}
