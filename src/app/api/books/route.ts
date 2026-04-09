import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { BooksService } from "@/server/services/books.service";
import type { CreateBookDto } from "@/server/services/books-types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skipRaw = Number(searchParams.get("skip") ?? "0");
    const takeRaw = Number(searchParams.get("take") ?? "12");
    const search = searchParams.get("search") ?? undefined;
    const skip = Math.max(0, skipRaw);
    const take = Math.min(50, Math.max(1, takeRaw));
    const books = new BooksService();
    const page = await books.findPage(skip, take, search);
    return NextResponse.json(page);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireBearerPayload(request);
    const body = (await request.json()) as CreateBookDto;
    const books = new BooksService();
    const created = await books.create(user.sub, body);
    return NextResponse.json(created);
  } catch (e) {
    return handleRouteError(e);
  }
}
