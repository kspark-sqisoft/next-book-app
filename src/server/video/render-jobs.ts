// 서버 비디오 렌더 잡 — 인메모리 스토어(단일 서버 프로세스 기준).
// 렌더가 오래 걸리므로 요청은 즉시 jobId를 받고, 클라이언트가 진행률을 폴링한다.
// 완료 시 MP4를 기존 업로드 경로(saveBookMainAndPoster)로 저장하고 결과 URL을 노출한다.
import { randomUUID } from "node:crypto";

import { saveBookMainAndPoster } from "@/server/books/save-book-media";
import { BooksService } from "@/server/services/books.service";

import { concatUploadedVideosToMp4 } from "./concat-videos";
import {
  capturePosterFromMp4,
  renderTwickProjectToMp4,
  type TwickRenderInput,
  type TwickRenderSettings,
} from "./twick-render";

export type RenderJobStatus =
  | "pending"
  | "rendering"
  | "saving"
  | "done"
  | "error";

export type RenderJobResult = {
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
};

export type RenderJob = {
  id: string;
  bookId: number;
  status: RenderJobStatus;
  /** 0..1 */
  progress: number;
  result: RenderJobResult | null;
  error: string | null;
  createdAt: number;
};

/** 클라이언트로 내보내는 공개 형태(내부 필드 제외) */
export type RenderJobView = Pick<
  RenderJob,
  "status" | "progress" | "result" | "error"
>;

const jobs = new Map<string, RenderJob>();

/** 완료/실패 후 일정 시간 지난 잡을 정리해 메모리 누수를 막는다. */
const JOB_TTL_MS = 30 * 60 * 1000;
function gcJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const finished = job.status === "done" || job.status === "error";
    if (finished && now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function getRenderJob(id: string): RenderJob | null {
  return jobs.get(id) ?? null;
}

export function toRenderJobView(job: RenderJob): RenderJobView {
  return {
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error,
  };
}

export function startRenderJob(params: {
  bookId: number;
  input: TwickRenderInput;
  settings: TwickRenderSettings;
}): string {
  gcJobs();
  const id = randomUUID();
  const job: RenderJob = {
    id,
    bookId: params.bookId,
    status: "pending",
    progress: 0,
    result: null,
    error: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  // 백그라운드 실행 — 요청은 기다리지 않는다.
  void runJob(job, params.input, params.settings);
  return id;
}

async function runJob(
  job: RenderJob,
  input: TwickRenderInput,
  settings: TwickRenderSettings,
): Promise<void> {
  try {
    job.status = "rendering";
    const buf = await renderTwickProjectToMp4(input, settings, (p) => {
      // 저장 단계(마지막 5%)를 위해 렌더는 0~0.95로 매핑
      job.progress = Math.min(0.95, p * 0.95);
    });
    await finishJobWithMp4(job, buf, "edited-video.mp4");
  } catch (e) {
    job.error = e instanceof Error ? e.message : String(e);
    job.status = "error";
  }
}

/** 업로드된 비디오 여러 개를 이어붙이는 잡 — 진행률·저장 흐름은 렌더 잡과 동일 */
export function startConcatJob(params: {
  bookId: number;
  urls: string[];
}): string {
  gcJobs();
  const id = randomUUID();
  const job: RenderJob = {
    id,
    bookId: params.bookId,
    status: "pending",
    progress: 0,
    result: null,
    error: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  void runConcatJob(job, params.urls);
  return id;
}

async function runConcatJob(job: RenderJob, urls: string[]): Promise<void> {
  try {
    job.status = "rendering";
    const buf = await concatUploadedVideosToMp4(urls, (p) => {
      job.progress = Math.min(0.95, p * 0.95);
    });
    await finishJobWithMp4(job, buf, "concat-video.mp4");
  } catch (e) {
    job.error = e instanceof Error ? e.message : String(e);
    job.status = "error";
  }
}

/** 완성된 MP4를 업로드 경로에 저장하고 poster를 만들어 잡을 완료 상태로 만든다 */
async function finishJobWithMp4(
  job: RenderJob,
  buf: Buffer,
  fileName: string,
): Promise<void> {
  job.status = "saving";
  // 결과 영상의 첫 프레임을 poster(JPEG)로 만들어 함께 저장 → 미디어 라이브러리 썸네일.
  const posterBuf = await capturePosterFromMp4(buf).catch(() => null);
  // Node Buffer → BlobPart(Uint8Array)로 감싸 File 생성(TS 타입 호환)
  const file = new File([new Uint8Array(buf)], fileName, {
    type: "video/mp4",
  });
  const poster = posterBuf
    ? new File([new Uint8Array(posterBuf)], "poster.jpg", {
        type: "image/jpeg",
      })
    : null;
  const { main, posterFilename } = await saveBookMainAndPoster(file, poster);
  const books = new BooksService();
  const meta = books.mapUploadedFile(main);
  const posterUrl = posterFilename
    ? books.mapPosterFile({ filename: posterFilename })
    : null;

  job.result = { kind: meta.kind, url: meta.url, posterUrl };
  job.progress = 1;
  job.status = "done";
}
