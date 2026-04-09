import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { HttpError } from "@/server/http/http-error";
import { PostsService } from "@/server/services/posts.service";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "유효하지 않은 id입니다.");
  }
  return n;
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const id = parseId(idStr);
    const posts = new PostsService();
    const state = await posts.addLike(user.sub, id);
    return NextResponse.json(state);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const id = parseId(idStr);
    const posts = new PostsService();
    const state = await posts.removeLike(user.sub, id);
    return NextResponse.json(state);
  } catch (e) {
    return handleRouteError(e);
  }
}
