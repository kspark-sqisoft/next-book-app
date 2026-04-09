import { readFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";

import { UPLOAD_ROOT } from "@/server/env";

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

export async function GET(
  _request: Request,
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
  try {
    const buf = await readFile(full);
    return new Response(buf, {
      headers: {
        "Content-Type": contentTypeForPath(rel),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
