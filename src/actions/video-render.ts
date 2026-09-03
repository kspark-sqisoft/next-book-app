"use server";

// 서버측 비디오 렌더 — 시작(잡 생성)·진행 상태 조회. 실제 렌더는 헤드리스 Chromium에서 수행된다.
import {
  assertPositiveIntId,
  rethrowActionError,
} from "@/actions/action-guards";
import { requireUser } from "@/server/auth/session";
import { HttpError } from "@/server/http/http-error";
import { BooksService } from "@/server/services/books.service";
import {
  getRenderJob,
  type RenderJobView,
  startConcatJob,
  startRenderJob,
  toRenderJobView,
} from "@/server/video/render-jobs";
import type {
  TwickRenderInput,
  TwickRenderSettings,
} from "@/server/video/twick-render";

export async function startBookVideoRenderAction(
  bookId: number,
  input: TwickRenderInput,
  settings: TwickRenderSettings,
): Promise<{ jobId: string }> {
  try {
    const user = await requireUser();
    const id = assertPositiveIntId(bookId);
    await new BooksService().assertBookOwner(id, {
      id: user.sub,
      role: user.role,
    });
    if (!input || !Array.isArray(input.tracks) || input.tracks.length === 0) {
      throw new HttpError(400, "렌더할 트랙이 없습니다.");
    }
    const jobId = startRenderJob({ bookId: id, input, settings });
    return { jobId };
  } catch (e) {
    rethrowActionError(e, "video-render");
  }
}

/** 업로드된 비디오들을 순서대로 이어붙이는 잡 시작 — 진행 조회는 렌더 잡과 공용 */
export async function startBookVideoConcatAction(
  bookId: number,
  urls: string[],
): Promise<{ jobId: string }> {
  try {
    const user = await requireUser();
    const id = assertPositiveIntId(bookId);
    await new BooksService().assertBookOwner(id, {
      id: user.sub,
      role: user.role,
    });
    if (
      !Array.isArray(urls) ||
      urls.length < 2 ||
      urls.length > 10 ||
      urls.some((u) => typeof u !== "string" || !u)
    ) {
      throw new HttpError(400, "이어붙일 비디오를 2~10개 선택하세요.");
    }
    const jobId = startConcatJob({ bookId: id, urls });
    return { jobId };
  } catch (e) {
    rethrowActionError(e, "video-render");
  }
}

export async function getBookVideoRenderJobAction(
  jobId: string,
): Promise<RenderJobView> {
  try {
    await requireUser();
    const job = getRenderJob(jobId);
    if (!job) throw new HttpError(404, "렌더 작업을 찾을 수 없습니다.");
    return toRenderJobView(job);
  } catch (e) {
    rethrowActionError(e, "video-render");
  }
}
