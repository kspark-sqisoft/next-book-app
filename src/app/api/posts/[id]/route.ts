import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { getBearerPayload, requireBearerPayload } from "@/server/http/request-auth";
import { HttpError } from "@/server/http/http-error";
import { cleanupPostUploadedFiles } from "@/server/posts/cleanup-uploaded";
import { parsePostPatchMultipart } from "@/server/posts/save-post-files";
import {
  PostsService,
  type UploadedPostFile,
} from "@/server/services/posts.service";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "유효하지 않은 id입니다.");
  }
  return n;
}

function parseMediaPlan(
  mediaPlanRaw: string | undefined,
): Array<{ t: "e"; id: number } | { t: "n"; i: number }> | undefined {
  if (!mediaPlanRaw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(mediaPlanRaw) as { items?: unknown };
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new HttpError(400, "mediaPlan.items 가 필요합니다.");
    }
    return parsed.items.map((x: unknown) => {
      if (!x || typeof x !== "object") throw new Error();
      const o = x as { t?: string; id?: number; i?: number };
      if (o.t === "e" && typeof o.id === "number") return { t: "e" as const, id: o.id };
      if (o.t === "n" && typeof o.i === "number") return { t: "n" as const, i: o.i };
      throw new Error();
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(
      400,
      'mediaPlan 형식이 올바르지 않습니다. 예: {"items":[{"t":"e","id":1},{"t":"n","i":0}]}',
    );
  }
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = parseId(idStr);
    const user = await getBearerPayload(request);
    const posts = new PostsService();
    const post = await posts.findOne(id, user?.sub);
    return NextResponse.json(post);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  let toClean: UploadedPostFile[] = [];
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const id = parseId(idStr);
    const fd = await request.formData();
    const body = await parsePostPatchMultipart(fd);
    toClean = [...body.newFiles, ...body.newPosters];

    const clearAllMedia =
      body.newFiles.length === 0 &&
      !body.mediaPlanRaw?.trim() &&
      body.removeMedia === true;

    const mediaPlan = parseMediaPlan(body.mediaPlanRaw);

    const posts = new PostsService();
    const updated = await posts.updatePost(
      { id: user.sub, role: user.role },
      id,
      {
        title: body.title,
        content: body.content,
        category: body.category,
        clearAllMedia: clearAllMedia || undefined,
        mediaPlan,
        newFiles: body.newFiles,
        newPosters: body.newPosters,
      },
    );
    return NextResponse.json(updated);
  } catch (e) {
    await cleanupPostUploadedFiles(toClean);
    return handleRouteError(e);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const id = parseId(idStr);
    const posts = new PostsService();
    await posts.remove({ id: user.sub, role: user.role }, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
