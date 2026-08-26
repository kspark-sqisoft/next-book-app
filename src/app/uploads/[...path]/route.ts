// 업로드 정적 파일 서빙: UPLOAD_ROOT 기준, 경로 탈출 차단, Range(부분 요청)·스트리밍 지원
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";

import { parseByteRange } from "@/lib/http-range";
import { UPLOAD_ROOT } from "@/server/env";

// 확장자별 Content-Type
function contentTypeForPath(rel: string): string {
  const lower = rel.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

/**
 * `Readable.toWeb()`은 클라이언트가 응답을 중단(비디오 seek 등)한 뒤 남은 청크를
 * 닫힌 컨트롤러에 넣으며 "Controller is already closed" uncaughtException을 낸다 —
 * 취소 시 파일 스트림을 destroy하고 닫힌 뒤 enqueue는 무시하는 어댑터로 직접 감싼다.
 */
function fileStream(path: string, range?: { start: number; end: number }) {
  const nodeStream = createReadStream(
    path,
    range ? { start: range.start, end: range.end } : {},
  );
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: string | Buffer) => {
        try {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          controller.enqueue(new Uint8Array(buf));
          // 소비가 느리면 일시정지 — pull()에서 재개(백프레셔)
          if ((controller.desiredSize ?? 0) <= 0) nodeStream.pause();
        } catch {
          nodeStream.destroy();
        }
      });
      nodeStream.on("end", () => {
        try {
          controller.close();
        } catch {
          /* 이미 닫힘 */
        }
      });
      nodeStream.on("error", (e) => {
        try {
          controller.error(e);
        } catch {
          /* 이미 닫힘 */
        }
      });
    },
    pull() {
      nodeStream.resume();
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  if (!segments?.length) {
    return new Response("Not Found", { status: 404 });
  }
  if (segments.some((s) => s.includes("..") || s.includes("/"))) {
    return new Response("Bad Request", { status: 400 });
  }
  const rel = segments.join("/");
  const base = resolve(UPLOAD_ROOT);
  const full = resolve(normalize(join(base, ...segments)));
  if (!full.startsWith(base)) {
    return new Response("Forbidden", { status: 403 });
  }

  let info;
  try {
    info = await stat(full);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  if (!info.isFile()) {
    return new Response("Not Found", { status: 404 });
  }

  const size = info.size;
  const baseHeaders: Record<string, string> = {
    "Content-Type": contentTypeForPath(rel),
    "Cache-Control": "public, max-age=3600",
    // 비디오 탐색(seek)에 필요: 브라우저가 부분 요청 가능 여부를 이 헤더로 판단
    "Accept-Ranges": "bytes",
    // 업로드 파일이 브라우저 스니핑으로 HTML/스크립트로 실행되지 않게
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };

  const range = parseByteRange(request.headers.get("range"), size);
  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, "Content-Range": `bytes */${size}` },
    });
  }
  if (range) {
    return new Response(fileStream(full, range), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }

  return new Response(fileStream(full), {
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
