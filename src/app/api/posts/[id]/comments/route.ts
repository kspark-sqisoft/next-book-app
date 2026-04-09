import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { HttpError } from "@/server/http/http-error";
import { CommentsService } from "@/server/services/comments.service";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "유효하지 않은 id입니다.");
  }
  return n;
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const postId = parseId(idStr);
    const comments = new CommentsService();
    const tree = await comments.findTreeByPostId(postId);
    return NextResponse.json(tree);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const postId = parseId(idStr);
    const body = (await request.json()) as {
      content?: string;
      parentId?: number;
    };
    const comments = new CommentsService();
    const created = await comments.create(postId, user.sub, {
      content: body.content ?? "",
      parentId: body.parentId ?? undefined,
    });
    return NextResponse.json(created);
  } catch (e) {
    return handleRouteError(e);
  }
}
