import { join } from "node:path";
import {
  POST_IMAGES_SUBDIR,
  POST_VIDEO_POSTERS_SUBDIR,
  POST_VIDEOS_SUBDIR,
  UPLOAD_ROOT,
} from "@/server/env";
import { tryUnlink } from "@/server/uploads/write-file";
import type { UploadedPostFile } from "@/server/services/posts.service";

export async function cleanupPostUploadedFiles(
  files: UploadedPostFile[],
): Promise<void> {
  for (const f of files) {
    await tryUnlink(join(UPLOAD_ROOT, POST_IMAGES_SUBDIR, f.filename));
    await tryUnlink(join(UPLOAD_ROOT, POST_VIDEOS_SUBDIR, f.filename));
    await tryUnlink(join(UPLOAD_ROOT, POST_VIDEO_POSTERS_SUBDIR, f.filename));
  }
}
