"use server";

import { join } from "node:path";

import { headers } from "next/headers";

import {
  assertPositiveIntId,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
import type { Cat } from "@/lib/api";
import {
  parseCreateCatBody,
  parseUpdateCatBody,
} from "@/server/cats/parse-cat-body";
import { CAT_IMAGES_SUBDIR, UPLOAD_ROOT } from "@/server/env";
import { HttpError } from "@/server/http/http-error";
import type { CatPublic } from "@/server/services/cats.service";
import { CatsService } from "@/server/services/cats.service";
import { saveFormFileToDir } from "@/server/uploads/write-file";

const CAT_IMAGE_MAX = 3 * 1024 * 1024;
const catMime = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function serializeCat(c: CatPublic): Cat {
  return {
    id: c.id,
    name: c.name,
    age: c.age,
    breed: c.breed,
    imageUrl: c.imageUrl,
    ownerId: c.ownerId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export type CatsListActionResult = {
  cats: Cat[];
  _study: {
    decoratorCatsClientMeta: { ip: string; userAgent: string };
  };
};

/** 공개: 목록 + 공부용 클라이언트 메타(프록시 헤더 기준) */
export async function listCatsAction(): Promise<CatsListActionResult> {
  try {
    const h = await headers();
    const xf = h.get("x-forwarded-for");
    const ip =
      xf?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "";
    const userAgent = h.get("user-agent") ?? "";
    const cats = new CatsService();
    const list = await cats.findAll();
    return {
      cats: list.map(serializeCat),
      _study: { decoratorCatsClientMeta: { ip, userAgent } },
    };
  } catch (e) {
    rethrowActionError(e, "cats-actions");
  }
}

/** 공개: 단건 */
export async function getCatAction(catId: number): Promise<Cat> {
  try {
    const id = assertPositiveIntId(catId);
    const cats = new CatsService();
    const cat = await cats.findOne(id);
    return serializeCat(cat);
  } catch (e) {
    rethrowActionError(e, "cats-actions");
  }
}

/** JWT 필요 */
export async function createCatAction(
  accessToken: string | null | undefined,
  input: { name: string; age?: number; breed?: string },
): Promise<Cat> {
  try {
    const user = await requireUserFromToken(accessToken);
    const body = parseCreateCatBody(input);
    const cats = new CatsService();
    const created = await cats.create(body, user.sub);
    return serializeCat(created);
  } catch (e) {
    rethrowActionError(e, "cats-actions");
  }
}

/** JWT 필요 */
export async function updateCatAction(
  accessToken: string | null | undefined,
  catId: number,
  body: { name?: string; age?: number; breed?: string },
): Promise<Cat> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(catId);
    const dto = parseUpdateCatBody(body);
    const cats = new CatsService();
    const updated = await cats.update(id, dto, {
      id: user.sub,
      role: user.role,
    });
    return serializeCat(updated);
  } catch (e) {
    rethrowActionError(e, "cats-actions");
  }
}

/** JWT 필요. `formData`에 `image` 필드(File) */
export async function uploadCatImageAction(
  accessToken: string | null | undefined,
  catId: number,
  formData: FormData,
): Promise<Cat> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(catId);
    const image = formData.get("image");
    if (!(image instanceof File) || image.size === 0) {
      throw new HttpError(400, "image 파일이 필요합니다.");
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
        throw new HttpError(
          400,
          "고양이 사진은 JPEG, PNG, GIF, WebP만 업로드할 수 있습니다.",
        );
      }
      if (String(err) === "FILE_TOO_LARGE") {
        throw new HttpError(400, "파일이 너무 큽니다.");
      }
      throw err;
    }
    const cats = new CatsService();
    const updated = await cats.uploadImage(id, filename, {
      id: user.sub,
      role: user.role,
    });
    return serializeCat(updated);
  } catch (e) {
    rethrowActionError(e, "cats-actions");
  }
}

/** JWT 필요 */
export async function deleteCatAction(
  accessToken: string | null | undefined,
  catId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(catId);
    const cats = new CatsService();
    await cats.remove(id, { id: user.sub, role: user.role });
  } catch (e) {
    rethrowActionError(e, "cats-actions");
  }
}
