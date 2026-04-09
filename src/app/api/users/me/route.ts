import { NextResponse } from "next/server";
import { join } from "node:path";
import { handleRouteError, jsonError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { AVATARS_SUBDIR, UPLOAD_ROOT } from "@/server/env";
import { HttpError } from "@/server/http/http-error";
import { saveFormFileToDir, tryUnlink } from "@/server/uploads/write-file";
import { UsersService } from "@/server/services/users.service";
import { UserRole } from "@/server/users/user-role";

const AVATAR_MAX = 2 * 1024 * 1024;
const avatarMime = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function parsePatchMeRole(raw: string | undefined): UserRole | undefined {
  if (raw === undefined || raw === null) return undefined;
  const t = raw.trim().toLowerCase();
  if (t === "") return undefined;
  if (t === "admin") return UserRole.Admin;
  if (t === "user") return UserRole.User;
  throw new HttpError(400, "role은 user 또는 admin 이어야 합니다.");
}

export async function GET(request: Request) {
  try {
    const user = await requireBearerPayload(request);
    const users = new UsersService();
    const me = await users.getMeProfile(user.sub);
    return NextResponse.json({
      sub: me.sub,
      email: me.email,
      name: me.name,
      imageUrl: me.imageUrl,
      role: me.role,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireBearerPayload(request);
    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return jsonError(400, "multipart/form-data 가 필요합니다.");
    }
    const fd = await request.formData();
    const nameRaw = fd.get("name");
    const removeImage = fd.get("removeImage");
    const roleRaw = fd.get("role");
    const image = fd.get("image");

    const file = image instanceof File && image.size > 0 ? image : undefined;
    const remove =
      !file &&
      (removeImage === "1" ||
        removeImage === "true" ||
        removeImage === "on");
    const nameTrimmed =
      typeof nameRaw === "string" ? nameRaw.trim() : "";
    const hasName = nameTrimmed.length > 0;
    const roleParsed = parsePatchMeRole(
      typeof roleRaw === "string" ? roleRaw : undefined,
    );
    const hasRole = roleParsed !== undefined;

    if (!file && !remove && !hasName && !hasRole) {
      return jsonError(
        400,
        "이름·역할을 바꾸거나, 프로필 이미지를 선택·제거해 주세요.",
      );
    }

    let newImageFilename: string | undefined;
    if (file) {
      try {
        const dest = join(UPLOAD_ROOT, AVATARS_SUBDIR);
        const saved = await saveFormFileToDir({
          file,
          destDir: dest,
          maxBytes: AVATAR_MAX,
          allowedMime: avatarMime,
          fallbackExt: ".jpg",
        });
        newImageFilename = saved.filename;
      } catch (err) {
        if (String(err) === "MIME_NOT_ALLOWED") {
          return jsonError(
            400,
            "프로필 이미지는 JPEG, PNG, GIF, WebP만 업로드할 수 있습니다.",
          );
        }
        if (String(err) === "FILE_TOO_LARGE") {
          return jsonError(400, "프로필 이미지가 너무 큽니다.");
        }
        throw err;
      }
    }

    const users = new UsersService();
    try {
      const me = await users.updateMyProfile(user.sub, {
        ...(hasName ? { name: nameTrimmed } : {}),
        ...(hasRole ? { role: roleParsed } : {}),
        ...(newImageFilename ? { newImageFilename } : {}),
        ...(remove ? { removeImage: true } : {}),
      });
      return NextResponse.json({
        sub: me.sub,
        email: me.email,
        name: me.name,
        imageUrl: me.imageUrl,
        role: me.role,
      });
    } catch (e) {
      if (newImageFilename) {
        await tryUnlink(join(UPLOAD_ROOT, AVATARS_SUBDIR, newImageFilename));
      }
      throw e;
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
