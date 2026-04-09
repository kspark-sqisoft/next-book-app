import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { HttpError } from "@/server/http/http-error";
import { BooksService } from "@/server/services/books.service";
import type { UpdateBookDto } from "@/server/services/books-types";

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
    const id = parseId(idStr);
    const books = new BooksService();
    const book = await books.findOne(id);
    return NextResponse.json(book);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const id = parseId(idStr);
    const body = (await request.json()) as UpdateBookDto;
    const books = new BooksService();
    const updated = await books.update(
      id,
      { id: user.sub, role: user.role },
      body,
    );
    return NextResponse.json(updated);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await requireBearerPayload(request);
    const { id: idStr } = await ctx.params;
    const id = parseId(idStr);
    const books = new BooksService();
    await books.remove(id, { id: user.sub, role: user.role });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
