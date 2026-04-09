import { NextResponse } from "next/server";
import { join } from "node:path";
import { handleRouteError, jsonError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { CAT_IMAGES_SUBDIR, UPLOAD_ROOT } from "@/server/env";
import { HttpError } from "@/server/http/http-error";
import { saveFormFileToDir } from "@/server/uploads/write-file";
import { CatsService } from "@/server/services/cats.service";

const CAT_IMAGE_MAX = 3 * 1024 * 1024;
const catMime = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type Ctx = { params: Promise<{ id: string }> };

function parseCatId(raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "유효하지 않은 id입니다.");
  }
  return n;
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const id = parseCatId(idStr);
    const fd = await request.formData();
    const image = fd.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return jsonError(400, "image 파일이 필요합니다.");
    }
    let filename: string;
    try {
      const dest = join(UPLOAD_ROOT, CAT_IMAGES_SUBDIR);
      const saved = await saveFormFileToDir({
        file: image,
        destDir: dest,
        maxBytes: CAT_IMAGE_MAX,
        allowedMime: catMime,
        fallbackExt: ".jpg",
      });
      filename = saved.filename;
    } catch (err) {
      if (String(err) === "MIME_NOT_ALLOWED") {
        return jsonError(
          400,
          "고양이 사진은 JPEG, PNG, GIF, WebP만 업로드할 수 있습니다.",
        );
      }
      if (String(err) === "FILE_TOO_LARGE") {
        return jsonError(400, "파일이 너무 큽니다.");
      }
      throw err;
    }
    const cats = new CatsService();
    const updated = await cats.uploadImage(id, filename, {
      id: user.sub,
      role: user.role,
    });
    return NextResponse.json(updated);
  } catch (e) {
    return handleRouteError(e);
  }
}
