import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { BookAiService } from "@/server/services/book-ai.service";

export async function POST(request: Request) {
  try {
    const user = await requireBearerPayload(request);
    const body = (await request.json()) as {
      message?: string;
      slideWidth?: number;
      slideHeight?: number;
      pageCount?: number;
      activeSlideIndex?: number;
      selection?: { elementId?: string; kind?: string };
      bookId?: number;
    };

    const ai = new BookAiService();
    const result = await ai.interpretLayoutIntent({
      message: body.message ?? "",
      slideWidth: Number(body.slideWidth),
      slideHeight: Number(body.slideHeight),
      pageCount: Number(body.pageCount),
      activeSlideIndex: Number(body.activeSlideIndex),
      selection:
        body.selection?.elementId &&
        (body.selection.kind === "image" || body.selection.kind === "video")
          ? {
              elementId: String(body.selection.elementId).trim().slice(0, 80),
              kind: body.selection.kind,
            }
          : undefined,
    });

    const bid = body.bookId;
    if (bid !== undefined && bid !== null) {
      const id = Math.floor(Number(bid));
      if (Number.isFinite(id) && id > 0) {
        await ai
          .tryPersistChatTurn(
            id,
            { id: user.sub, role: user.role },
            body.message ?? "",
            result.reply,
          )
          .catch(() => undefined);
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    return handleRouteError(e);
  }
}
