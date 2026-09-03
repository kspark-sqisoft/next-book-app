"use server";

// 북 미디어 라이브러리 서버 액션: 목록·추가·삭제·파일별 공유(특정 회원/모든 사용자)
import {
  assertPositiveIntId,
  rethrowActionError,
} from "@/actions/action-guards";
import { requireUser } from "@/server/auth/session";
import {
  type BookMediaLibraryPublic,
  BookMediaService,
} from "@/server/services/book-media.service";

const TAG = "book-media-actions";

export async function listBookMediaLibraryAction(
  bookId: number,
): Promise<BookMediaLibraryPublic> {
  try {
    const user = await requireUser();
    return await new BookMediaService().list(assertPositiveIntId(bookId), {
      id: user.sub,
      role: user.role,
    });
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 업로드 결과를 라이브러리에 기록 — 갱신된 목록 반환 */
export async function addBookMediaLibraryItemAction(
  bookId: number,
  input: { kind: string; src: string; posterSrc?: string | null },
): Promise<BookMediaLibraryPublic> {
  try {
    const user = await requireUser();
    return await new BookMediaService().add(
      assertPositiveIntId(bookId),
      { id: user.sub, role: user.role },
      {
        kind: String(input?.kind ?? ""),
        src: String(input?.src ?? ""),
        posterSrc: input?.posterSrc == null ? null : String(input.posterSrc),
      },
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 목록에서 제거 — 업로드한 사용자·관리자만 */
export async function removeBookMediaLibraryItemAction(
  mediaId: number,
): Promise<void> {
  try {
    const user = await requireUser();
    await new BookMediaService().remove(assertPositiveIntId(mediaId), {
      id: user.sub,
      role: user.role,
    });
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 특정 회원 공유 추가/해제 — 업로드한 사용자·관리자만 */
export async function setBookMediaShareAction(
  mediaId: number,
  userId: number,
  shared: boolean,
): Promise<void> {
  try {
    const user = await requireUser();
    await new BookMediaService().setShare(
      assertPositiveIntId(mediaId),
      { id: user.sub, role: user.role },
      assertPositiveIntId(userId),
      Boolean(shared),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 모든 사용자 공유 켜기/끄기 — 업로드한 사용자·관리자만 */
export async function setBookMediaShareAllAction(
  mediaId: number,
  shared: boolean,
): Promise<void> {
  try {
    const user = await requireUser();
    await new BookMediaService().setShareAll(
      assertPositiveIntId(mediaId),
      { id: user.sub, role: user.role },
      Boolean(shared),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
