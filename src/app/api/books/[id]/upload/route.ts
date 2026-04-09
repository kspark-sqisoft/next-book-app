import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { HttpError } from "@/server/http/http-error";
import { saveBookMainAndPoster } from "@/server/books/save-book-media";
import { BooksService } from "@/server/services/books.service";

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
    const books = new BooksService();
    await books.assertBookOwner(id, { id: user.sub, role: user.role });

    const fd = await request.formData();
    const file = fd.get("file");
    const poster = fd.get("poster");
    if (!(file instanceof File) || file.size === 0) {
      return jsonError(400, "file 필드가 필요합니다.");
    }
    const posterFile =
      poster instanceof File && poster.size > 0 ? poster : null;

    const { main, posterFilename } = await saveBookMainAndPoster(
      file,
      posterFile,
    );
    const meta = books.mapUploadedFile(main);
    let posterUrl: string | null = null;
    if (meta.kind === "video" && posterFilename) {
      posterUrl = books.mapPosterFile({ filename: posterFilename });
    }

    return NextResponse.json({ ...meta, posterUrl });
  } catch (e) {
    return handleRouteError(e);
  }
}
