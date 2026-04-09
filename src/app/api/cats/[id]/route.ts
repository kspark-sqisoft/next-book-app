import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { HttpError } from "@/server/http/http-error";
import { parseUpdateCatBody } from "@/server/cats/parse-cat-body";
import { CatsService } from "@/server/services/cats.service";

type Ctx = { params: Promise<{ id: string }> };

function parseCatId(raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "유효하지 않은 id입니다.");
  }
  return n;
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = parseCatId(idStr);
    const cats = new CatsService();
    const cat = await cats.findOne(id);
    return NextResponse.json(cat);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      return jsonError(404, e.message, {
        error: "CatNotFound",
        hint: "ExceptionFilter(CatNotFoundException) 가 응답을 꾸몄습니다.",
      });
    }
    return handleRouteError(e);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const id = parseCatId(idStr);
    const dto = parseUpdateCatBody(await request.json());
    const cats = new CatsService();
    const updated = await cats.update(id, dto, {
      id: user.sub,
      role: user.role,
    });
    return NextResponse.json(updated);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const id = parseCatId(idStr);
    const cats = new CatsService();
    await cats.remove(id, { id: user.sub, role: user.role });
    return NextResponse.json({ deletedId: id });
  } catch (e) {
    return handleRouteError(e);
  }
}
