// Next.js 서버 액션 모듈로 표시(클라이언트 번들에 포함되지 않게)
"use server";

import { join } from "node:path";

// 요청 헤더에서 IP·UA 등 읽기
import { headers } from "next/headers";

// 세션 JWT 검증·에러 재던지기
import {
  assertPositiveIntId,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
// 클라이언트와 공유하는 Cat 타입(JSON 직렬화 날짜는 string)
import type { Cat } from "@/lib/api";
// 서버 전용 본문 파서
import {
  parseCreateCatBody,
  parseUpdateCatBody,
} from "@/server/cats/parse-cat-body";
import { CAT_IMAGES_SUBDIR, UPLOAD_ROOT } from "@/server/env";
import { HttpError } from "@/server/http/http-error";
import type { CatPublic } from "@/server/services/cats.service";
import { CatsService } from "@/server/services/cats.service";
// multipart 파일을 디스크에 안전하게 저장
import { saveFormFileToDir } from "@/server/uploads/write-file";

const CAT_IMAGE_MAX = 3 * 1024 * 1024; // 3MB 상한
const catMime = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]); // 허용 MIME

// 서비스 레이어 Date → ISO 문자열로 직렬화해 Cat 타입에 맞춤
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

// 목록 액션 반환: 데이터 + 공부용 메타
export type CatsListActionResult = {
  cats: Cat[];
  _study: {
    decoratorCatsClientMeta: { ip: string; userAgent: string };
  };
};

// 누구나 호출 가능; 프록시 뒤 클라이언트 식별 힌트를 같이 반환
export async function listCatsAction(): Promise<CatsListActionResult> {
  try {
    const h = await headers();
    const xf = h.get("x-forwarded-for"); // 체인의 첫 IP가 원 클라이언트에 가깝다는 관례
    const ip =
      xf?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? ""; // 단일 프록시 환경 대비
    const userAgent = h.get("user-agent") ?? "";
    const cats = new CatsService();
    const list = await cats.findAll();
    return {
      cats: list.map(serializeCat),
      _study: { decoratorCatsClientMeta: { ip, userAgent } },
    };
  } catch (e) {
    rethrowActionError(e, "cats-actions"); // HttpError 등을 액션 친화 형태로
  }
}

// 단건 조회; 인증 불필요
export async function getCatAction(catId: number): Promise<Cat> {
  try {
    const id = assertPositiveIntId(catId); // NaN·0·음수 방지
    const cats = new CatsService();
    const cat = await cats.findOne(id);
    return serializeCat(cat);
  } catch (e) {
    rethrowActionError(e, "cats-actions");
  }
}

// 로그인 사용자만; ownerId에 JWT sub 저장
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

// 소유자 또는 관리자만 실제로 갱신됨(서비스에서 403)
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

// FormData 필드명 `image`에 File 필요
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
      const dest = join(UPLOAD_ROOT, CAT_IMAGES_SUBDIR); // 고양이 전용 하위 폴더
      const saved = await saveFormFileToDir({
        file: image,
        destDir: dest,
        maxBytes: CAT_IMAGE_MAX,
        allowedMime: catMime,
        fallbackExt: ".jpg",
      });
      filename = saved.filename; // 디스크에 저장된 안전한 파일명
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
      throw err; // 예상 밖 오류는 그대로 전파
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

// 소유자·관리자만 성공
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
