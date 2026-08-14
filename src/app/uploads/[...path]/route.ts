// 업로드 정적 파일 서빙: UPLOAD_ROOT 기준, 경로 탈출 차단, Range(부분 요청)·스트리밍 지원
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";

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

function fileStream(path: string, range?: { start: number; end: number }) {
  return Readable.toWeb(
    createReadStream(path, range ? { start: range.start, end: range.end } : {}),
  ) as ReadableStream<Uint8Array>;
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
