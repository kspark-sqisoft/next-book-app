import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { HttpError } from "@/server/http/http-error";
import { BookAiService } from "@/server/services/book-ai.service";

export async function GET(request: Request) {
  try {
    const user = await requireBearerPayload(request);
    const { searchParams } = new URL(request.url);
    const bookIdRaw = searchParams.get("bookId");
    const bookId = bookIdRaw != null ? Math.floor(Number(bookIdRaw)) : NaN;
    if (!Number.isFinite(bookId) || bookId < 1) {
      throw new HttpError(400, "bookId가 필요합니다.");
    }
    const ai = new BookAiService();
    const lines = await ai.listLayoutChat(bookId, {
      id: user.sub,
      role: user.role,
    });
    return NextResponse.json(lines);
  } catch (e) {
    return handleRouteError(e);
  }
}
