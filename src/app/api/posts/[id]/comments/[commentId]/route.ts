import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { HttpError } from "@/server/http/http-error";
import { CommentsService } from "@/server/services/comments.service";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "유효하지 않은 id입니다.");
  }
  return n;
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr, commentId: cStr } = await ctx.params;
    const postId = parseId(idStr);
    const commentId = parseId(cStr);
    const comments = new CommentsService();
    await comments.remove(postId, commentId, { id: user.sub, role: user.role });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
