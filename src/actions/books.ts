"use server";

// 북 CRUD·미디어 업로드·레이아웃 AI 관련 서버 액션
import {
  assertPositiveIntId,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
import type {
  BookAiChatLineDto,
  BookDetail,
  BookLayoutAiResponse,
  BooksPageResponse,
  BookUploadResult,
} from "@/lib/api";
import { saveBookMainAndPoster } from "@/server/books/save-book-media";
import { BookAiService } from "@/server/services/book-ai.service";
import { BooksService } from "@/server/services/books.service";
import type {
  CreateBookDto,
  UpdateBookDto,
} from "@/server/services/books-types";

// offset 페이지네이션; 검색어 optional
export async function listBooksAction(params?: {
  skip?: number;
  take?: number;
  search?: string;
}): Promise<BooksPageResponse> {
  try {
    const skipRaw = Number(params?.skip ?? 0);
    const takeRaw = Number(params?.take ?? 12);
    const search = params?.search?.trim();
    const skip = Math.max(0, skipRaw);
    const take = Math.min(50, Math.max(1, takeRaw));
    const books = new BooksService();
    return (await books.findPage(
      skip,
      take,
      search,
    )) as unknown as BooksPageResponse;
  } catch (e) {
    rethrowActionError(e, "books-actions");
  }
}

export async function getBookAction(bookId: number): Promise<BookDetail> {
  try {
    const id = assertPositiveIntId(bookId);
    const books = new BooksService();
    return (await books.findOne(id)) as unknown as BookDetail;
  } catch (e) {
    rethrowActionError(e, "books-actions");
  }
}

export async function createBookAction(
  accessToken: string | null | undefined,
  body: CreateBookDto,
): Promise<BookDetail> {
  try {
    const user = await requireUserFromToken(accessToken);
    const books = new BooksService();
    return (await books.create(user.sub, body)) as unknown as BookDetail;
  } catch (e) {
    rethrowActionError(e, "books-actions");
  }
}

export async function updateBookAction(
  accessToken: string | null | undefined,
  bookId: number,
  body: UpdateBookDto,
): Promise<BookDetail> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(bookId);
    const books = new BooksService();
    return (await books.update(id, { id: user.sub, role: user.role }, body)) as unknown as BookDetail;
  } catch (e) {
    rethrowActionError(e, "books-actions");
  }
}

export async function deleteBookAction(
  accessToken: string | null | undefined,
  bookId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(bookId);
    const books = new BooksService();
    await books.remove(id, { id: user.sub, role: user.role });
  } catch (e) {
    rethrowActionError(e, "books-actions");
  }
}

// 슬라이드에 넣을 이미지/동영상 + 동영상일 때 포스터 파일
export async function uploadBookMediaAction(
  accessToken: string | null | undefined,
  bookId: number,
  formData: FormData,
): Promise<BookUploadResult> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(bookId);
    const books = new BooksService();
    await books.assertBookOwner(id, { id: user.sub, role: user.role });

    const file = formData.get("file");
    const poster = formData.get("poster");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("file 필드가 필요합니다.");
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

    return { ...meta, posterUrl };
  } catch (e) {
    rethrowActionError(e, "books-actions");
  }
}

// 북별 레이아웃 AI 대화 기록
export async function fetchBookAiChatAction(
  accessToken: string | null | undefined,
  bookId: number,
): Promise<BookAiChatLineDto[]> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(bookId);
    const ai = new BookAiService();
    const lines = await ai.listLayoutChat(id, {
      id: user.sub,
      role: user.role,
    });
    return lines;
  } catch (e) {
    rethrowActionError(e, "books-actions");
  }
}

// 자연어 → 배치 JSON 등; bookId 있으면 턴을 DB에 남김
export async function requestBookLayoutAiAction(
  accessToken: string | null | undefined,
  body: {
    message: string;
    slideWidth: number;
    slideHeight: number;
    pageCount: number;
    activeSlideIndex: number;
    selection?: { elementId: string; kind: "image" | "video" };
    bookId?: number;
  },
): Promise<BookLayoutAiResponse> {
  try {
    const user = await requireUserFromToken(accessToken);
    const ai = new BookAiService();
    const result = await ai.interpretLayoutIntent({
      message: body.message ?? "",
      slideWidth: Number(body.slideWidth),
      slideHeight: Number(body.slideHeight),
      pageCount: Number(body.pageCount),
      activeSlideIndex: Number(body.activeSlideIndex),
      selection: body.selection,
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
          .catch(() => undefined); // 저장 실패해도 응답은 반환
      }
    }

    return result as unknown as BookLayoutAiResponse;
  } catch (e) {
    rethrowActionError(e, "books-actions");
  }
}
