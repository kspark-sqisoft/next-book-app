// 북 미디어 라이브러리 서비스: 업로드 파일 목록을 서버에 보관하고
// 파일별로 특정 회원·모든 사용자에게 공유한다. 파일 실체는 디스크(/uploads)·행 삭제는 목록 제거만.
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";

import {
  type AuthActor,
  canMutateOwnedResource,
} from "@/server/auth/auth-policy";
import { getDb } from "@/server/db";
import {
  bookMediaItem,
  bookMediaShare,
  user as userTable,
} from "@/server/db/schema";
import { HttpError } from "@/server/http/http-error";
import { BooksService } from "@/server/services/books.service";

/** 북당 라이브러리 최대 항목 수(넘치면 오래된 항목부터 목록에서 제외) */
const MAX_ITEMS_PER_BOOK = 80;
const SRC_MAX = 512;

export type BookMediaItemPublic = {
  id: number;
  kind: "image" | "video";
  src: string;
  posterSrc: string | null;
  /** 업로드한 사용자 */
  ownerId: number;
  ownerName: string;
  /** 모든 사용자에게 공유 여부 */
  sharedToAll: boolean;
  /** 개별 공유받은 사용자 id(소유 항목에서만 채움) */
  sharedUserIds: number[];
};

export type BookMediaLibraryPublic = {
  /** 이 북의 라이브러리 항목(최신순) */
  items: BookMediaItemPublic[];
  /** 다른 사용자가 나에게(또는 전체에) 공유한 파일(최신순) */
  sharedItems: BookMediaItemPublic[];
};

/** 업로드 URL만 허용 — 외부 URL·경로 조작 저장 방지 */
function assertUploadSrc(value: unknown, label: string): string {
  const src = typeof value === "string" ? value.trim() : "";
  if (
    !src.startsWith("/uploads/") ||
    src.includes("..") ||
    src.length > SRC_MAX
  ) {
    throw new HttpError(400, `${label}이(가) 올바르지 않습니다.`);
  }
  return src;
}

export class BookMediaService {
  private db() {
    return getDb();
  }

  private mapRow(
    row: typeof bookMediaItem.$inferSelect,
    ownerNames: Map<number, string>,
    sharedIds: Map<number, number[]>,
  ): BookMediaItemPublic {
    return {
      id: row.id,
      kind: row.kind === "video" ? "video" : "image",
      src: row.src,
      posterSrc: row.posterSrc ?? null,
      ownerId: row.ownerId,
      ownerName: ownerNames.get(row.ownerId) ?? "",
      sharedToAll: row.sharedToAll === true,
      sharedUserIds: sharedIds.get(row.id) ?? [],
    };
  }

  private async ownerNames(ids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const uniq = [...new Set(ids)];
    if (uniq.length === 0) return map;
    const rows = await this.db()
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(inArray(userTable.id, uniq));
    for (const u of rows) map.set(u.id, u.name);
    return map;
  }

  /** 항목 id → 개별 공유 사용자 id 목록 */
  private async sharedIdsFor(
    itemIds: number[],
  ): Promise<Map<number, number[]>> {
    const map = new Map<number, number[]>();
    if (itemIds.length === 0) return map;
    const rows = await this.db()
      .select({
        mediaId: bookMediaShare.mediaId,
        userId: bookMediaShare.userId,
      })
      .from(bookMediaShare)
      .where(inArray(bookMediaShare.mediaId, itemIds));
    for (const r of rows) {
      const list = map.get(r.mediaId) ?? [];
      list.push(r.userId);
      map.set(r.mediaId, list);
    }
    return map;
  }

  /** 북 편집 권한자(작성자·관리자·공유받은 사용자)만 라이브러리 접근 */
  private async assertBookEditor(bookId: number, actor: AuthActor) {
    await new BooksService().assertBookOwner(bookId, actor);
  }

  async list(
    bookId: number,
    actor: AuthActor,
  ): Promise<BookMediaLibraryPublic> {
    await this.assertBookEditor(bookId, actor);
    const db = this.db();

    const items = await db
      .select()
      .from(bookMediaItem)
      .where(eq(bookMediaItem.bookId, bookId))
      .orderBy(desc(bookMediaItem.id));

    // 다른 사용자의 파일 중 전체 공유이거나 나에게 개별 공유된 것 — 다른 북 항목만
    const sharedRows = await db
      .select({ item: bookMediaItem })
      .from(bookMediaItem)
      .leftJoin(
        bookMediaShare,
        and(
          eq(bookMediaShare.mediaId, bookMediaItem.id),
          eq(bookMediaShare.userId, actor.id),
        ),
      )
      .where(
        and(
          ne(bookMediaItem.ownerId, actor.id),
          ne(bookMediaItem.bookId, bookId),
          or(
            eq(bookMediaItem.sharedToAll, true),
            eq(bookMediaShare.userId, actor.id),
          ),
        ),
      )
      .orderBy(desc(bookMediaItem.id));
    // 같은 파일이 여러 북에 있으면 src 기준 한 번만
    const seenSrc = new Set(items.map((it) => it.src));
    const sharedItems: (typeof bookMediaItem.$inferSelect)[] = [];
    for (const r of sharedRows) {
      if (seenSrc.has(r.item.src)) continue;
      seenSrc.add(r.item.src);
      sharedItems.push(r.item);
    }

    const [ownerNames, sharedIds] = await Promise.all([
      this.ownerNames([
        ...items.map((it) => it.ownerId),
        ...sharedItems.map((it) => it.ownerId),
      ]),
      this.sharedIdsFor(items.map((it) => it.id)),
    ]);
    return {
      items: items.map((it) => this.mapRow(it, ownerNames, sharedIds)),
      sharedItems: sharedItems.map((it) =>
        this.mapRow(it, ownerNames, new Map()),
      ),
    };
  }

  /** 업로드 직후 라이브러리에 기록 — 같은 src는 최신으로 교체, 최대 개수 유지 */
  async add(
    bookId: number,
    actor: AuthActor,
    input: { kind: string; src: string; posterSrc?: string | null },
  ): Promise<BookMediaLibraryPublic> {
    await this.assertBookEditor(bookId, actor);
    const kind = input.kind === "video" ? "video" : "image";
    const src = assertUploadSrc(input.src, "파일 주소");
    const posterSrc =
      input.posterSrc == null
        ? null
        : assertUploadSrc(input.posterSrc, "포스터 주소");

    const db = this.db();
    await db.transaction(async (tx) => {
      // 같은 북의 같은 src는 중복 대신 최신 항목으로 교체
      await tx
        .delete(bookMediaItem)
        .where(
          and(eq(bookMediaItem.bookId, bookId), eq(bookMediaItem.src, src)),
        );
      await tx.insert(bookMediaItem).values({
        bookId,
        ownerId: actor.id,
        kind,
        src,
        posterSrc,
      });
      // 최대 개수 초과분(오래된 순) 목록에서 제거 — 파일은 디스크에 남음
      const rows = await tx
        .select({ id: bookMediaItem.id })
        .from(bookMediaItem)
        .where(eq(bookMediaItem.bookId, bookId))
        .orderBy(desc(bookMediaItem.id));
      const overflow = rows.slice(MAX_ITEMS_PER_BOOK).map((r) => r.id);
      if (overflow.length > 0) {
        await tx
          .delete(bookMediaItem)
          .where(inArray(bookMediaItem.id, overflow));
      }
    });
    return this.list(bookId, actor);
  }

  private async findOwnedItem(mediaId: number, actor: AuthActor) {
    const row = await this.db().query.bookMediaItem.findFirst({
      where: eq(bookMediaItem.id, mediaId),
    });
    if (!row) throw new HttpError(404, "미디어를 찾을 수 없습니다.");
    if (!canMutateOwnedResource(actor, row.ownerId)) {
      throw new HttpError(403, "업로드한 사용자·관리자만 할 수 있습니다.");
    }
    return row;
  }

  /** 목록에서 제거 — 업로드한 사용자·관리자만 */
  async remove(mediaId: number, actor: AuthActor): Promise<void> {
    const row = await this.findOwnedItem(mediaId, actor);
    await this.db().delete(bookMediaItem).where(eq(bookMediaItem.id, row.id));
  }

  /** 특정 회원 공유 추가/해제 — 업로드한 사용자·관리자만 */
  async setShare(
    mediaId: number,
    actor: AuthActor,
    userId: number,
    shared: boolean,
  ): Promise<void> {
    const row = await this.findOwnedItem(mediaId, actor);
    if (userId === row.ownerId) {
      throw new HttpError(400, "업로드한 사용자에게는 공유할 수 없습니다.");
    }
    const db = this.db();
    const target = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: { id: true },
    });
    if (!target) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    if (shared) {
      await db
        .insert(bookMediaShare)
        .values({ mediaId: row.id, userId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(bookMediaShare)
        .where(
          and(
            eq(bookMediaShare.mediaId, row.id),
            eq(bookMediaShare.userId, userId),
          ),
        );
    }
  }

  /** 모든 사용자 공유 켜기/끄기 — 업로드한 사용자·관리자만 */
  async setShareAll(
    mediaId: number,
    actor: AuthActor,
    shared: boolean,
  ): Promise<void> {
    const row = await this.findOwnedItem(mediaId, actor);
    await this.db()
      .update(bookMediaItem)
      .set({ sharedToAll: shared })
      .where(eq(bookMediaItem.id, row.id));
  }
}
