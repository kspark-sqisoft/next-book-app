"use server";

// 서버측 비디오 렌더 — 시작(잡 생성)·진행 상태 조회. 실제 렌더는 헤드리스 Chromium에서 수행된다.
import {
  assertPositiveIntId,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
import { HttpError } from "@/server/http/http-error";
import { BooksService } from "@/server/services/books.service";
import {
  getRenderJob,
  type RenderJobView,
  startRenderJob,
  toRenderJobView,
} from "@/server/video/render-jobs";
import type {
  TwickRenderInput,
  TwickRenderSettings,
} from "@/server/video/twick-render";

export async function startBookVideoRenderAction(
  accessToken: string | null | undefined,
  bookId: number,
  input: TwickRenderInput,
  settings: TwickRenderSettings,
): Promise<{ jobId: string }> {
  try {
    const user = await requireUserFromToken(accessToken);
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

export async function getBookVideoRenderJobAction(
  accessToken: string | null | undefined,
  jobId: string,
): Promise<RenderJobView> {
  try {
    await requireUserFromToken(accessToken);
    const job = getRenderJob(jobId);
    if (!job) throw new HttpError(404, "렌더 작업을 찾을 수 없습니다.");
    return toRenderJobView(job);
  } catch (e) {
    rethrowActionError(e, "video-render");
  }
}
