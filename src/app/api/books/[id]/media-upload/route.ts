// 비디오 편집기(Twick "My assets") 로컬 파일 업로드 엔드포인트.
// Twick의 GCS 업로드 방식(FormData "file" POST → { url } 응답)에 맞춘다.
// Twick 내부 fetch는 Authorization 헤더를 붙이지 않으므로, 동일 오리진 쿠키(refresh_token)로 인증한다.
import { NextResponse } from "next/server";

import { verifyAccessToken, verifyRefreshToken } from "@/server/auth/jwt";
import type { JwtPayload } from "@/server/auth/jwt-payload";
import { saveBookMainAndPoster } from "@/server/books/save-book-media";
import { REFRESH_TOKEN_COOKIE } from "@/server/env";
import { getRequestCookie } from "@/server/http/cookies";
import { BooksService } from "@/server/services/books.service";

/** 편집기가 심어주는 access token 쿠키 이름 — Twick 업로드 fetch는 Bearer 헤더를 못 붙이므로 쿠키로 전달 */
const UPLOAD_ACCESS_COOKIE = "twick_upload_at";

/**
 * 이 앱의 1차 인증은 access token(Bearer)이지만 Twick 업로드 fetch는 헤더를 못 붙인다.
 * 그래서 편집기가 access token을 짧은 쿠키로 실어주고 여기서 검증한다. refresh 쿠키는 폴백.
 */
async function resolveUser(request: Request): Promise<JwtPayload | null> {
  const at = getRequestCookie(request, UPLOAD_ACCESS_COOKIE);
  if (at) {
    try {
      return await verifyAccessToken(at);
    } catch {
      /* 만료 등 — 폴백 시도 */
    }
  }
  const rt = getRequestCookie(request, REFRESH_TOKEN_COOKIE);
  if (rt) {
    try {
      return await verifyRefreshToken(rt);
    } catch {
      /* 무효 refresh — 인증 실패로 처리 */
    }
  }
  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await resolveUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const bookId = Number(id);
    if (!Number.isInteger(bookId) || bookId < 1) {
      return NextResponse.json(
        { error: "잘못된 북 id 입니다." },
        { status: 400 },
      );
    }

    const books = new BooksService();
    await books.assertBookOwner(bookId, { id: user.sub, role: user.role });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "file 필드가 필요합니다." },
        { status: 400 },
      );
    }

    const { main } = await saveBookMainAndPoster(file, null);
    const { url } = books.mapUploadedFile(main);
    // Twick(gcs provider)은 { url } 을 기대한다.
    return NextResponse.json({ url });
  } catch (e) {
    // Twick은 실패 응답의 { error } 를 사용자에게 노출한다.
    const message = e instanceof Error ? e.message : "업로드에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
