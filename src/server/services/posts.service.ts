import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  post,
  postAttachment,
  postComment,
  postLike,
} from "@/server/db/schema";
import {
  AVATARS_SUBDIR,
  POST_IMAGES_SUBDIR,
  POST_VIDEO_POSTERS_SUBDIR,
  POST_VIDEOS_SUBDIR,
  UPLOAD_ROOT,
} from "@/server/env";
import { type AuthActor, canMutateOwnedResource } from "@/server/auth/auth-policy";
import { HttpError } from "@/server/http/http-error";
import { POST_ATTACHMENTS_MAX_COUNT } from "@/server/posts/post-upload-constants";
import {
  POST_MEDIA_IMAGE_MAX_BYTES,
  POST_MEDIA_POSTER_MAX_BYTES,
} from "@/server/posts/post-upload-constants";
import {
  postContentPlainLength,
  sanitizePostContentHtml,
} from "@/server/posts/post-content-sanitize";
import { normalizePostCategory } from "@/server/posts/post-categories";

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export type PostAuthorPublic = {
  id: number;
  name: string;
  imageUrl: string | null;
};

export type PostMediaItemPublic = {
  id: number;
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
};

export type PostPublic = {
  id: number;
  title: string;
  content: string;
  category: string;
  media: PostMediaItemPublic[];
  coverThumbUrl: string | null;
  coverKind: "image" | "video" | null;
  imageUrl: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthorPublic;
  likeCount: number;
  likedByMe: boolean;
};

export type PostLikeState = { likeCount: number; likedByMe: boolean };

export type UploadedPostFile = {
  filename: string;
  mimetype: string;
  size: number;
};

type MediaPlanItem = { t: "e"; id: number } | { t: "n"; i: number };

type AttachmentRow = typeof postAttachment.$inferSelect;

export class PostsService {
  private static readonly SEARCH_MAX_LEN = 120;
  private static readonly POST_CONTENT_MAX = 200_000;

  private db() {
    return getDb();
  }

  private static multerKind(file: UploadedPostFile): "image" | "video" | null {
    if (IMAGE_MIME.has(file.mimetype)) return "image";
    if (VIDEO_MIME.has(file.mimetype)) return "video";
    return null;
  }

  private imagePublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${POST_IMAGES_SUBDIR}/${filename}`;
  }

  private videoPublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${POST_VIDEOS_SUBDIR}/${filename}`;
  }

  private videoPosterPublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${POST_VIDEO_POSTERS_SUBDIR}/${filename}`;
  }

  private authorAvatarUrl(profileImageFilename: string | null): string | null {
    if (!profileImageFilename) return null;
    return `/uploads/${AVATARS_SUBDIR}/${profileImageFilename}`;
  }

  private async unlinkPostImage(filename: string | null): Promise<void> {
    if (!filename) return;
    const full = join(UPLOAD_ROOT, POST_IMAGES_SUBDIR, filename);
    if (existsSync(full)) await unlink(full);
  }

  private async unlinkPostVideo(filename: string | null): Promise<void> {
    if (!filename) return;
    const full = join(UPLOAD_ROOT, POST_VIDEOS_SUBDIR, filename);
    if (existsSync(full)) await unlink(full);
  }

  private async unlinkPostVideoPoster(filename: string | null): Promise<void> {
    if (!filename) return;
    const full = join(UPLOAD_ROOT, POST_VIDEO_POSTERS_SUBDIR, filename);
    if (existsSync(full)) await unlink(full);
  }

  private async unlinkAttachmentRow(a: AttachmentRow): Promise<void> {
    if (a.kind === "image") {
      await this.unlinkPostImage(a.fileFilename);
    } else {
      await this.unlinkPostVideo(a.fileFilename);
      await this.unlinkPostVideoPoster(a.posterFilename);
    }
  }

  private async deleteAllAttachments(postId: number): Promise<void> {
    const db = this.db();
    const rows = await db
      .select()
      .from(postAttachment)
      .where(eq(postAttachment.postId, postId));
    for (const a of rows) {
      await this.unlinkAttachmentRow(a);
    }
    await db.delete(postAttachment).where(eq(postAttachment.postId, postId));
  }

  private sortedAttachments(list: AttachmentRow[]): AttachmentRow[] {
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private attachmentToPublic(a: AttachmentRow): PostMediaItemPublic {
    const url =
      a.kind === "image"
        ? this.imagePublicUrl(a.fileFilename)!
        : this.videoPublicUrl(a.fileFilename)!;
    const posterUrl =
      a.kind === "video" ? this.videoPosterPublicUrl(a.posterFilename) : null;
    return { id: a.id, kind: a.kind as "image" | "video", url, posterUrl };
  }

  private toPublic(
    row: {
      id: number;
      title: string;
      content: string;
      category: string | null;
      createdAt: Date;
      updatedAt: Date;
      author: {
        id: number;
        name: string;
        profileImageFilename: string | null;
      };
      attachments: AttachmentRow[];
    },
    extras?: PostLikeState,
  ): PostPublic {
    const media = this.sortedAttachments(row.attachments).map((a) =>
      this.attachmentToPublic(a),
    );
    const first = media[0];
    const coverThumbUrl = first
      ? first.kind === "image"
        ? first.url
        : (first.posterUrl ?? null)
      : null;
    const coverKind = first?.kind ?? null;

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category ?? "general",
      media,
      coverThumbUrl,
      coverKind,
      imageUrl: first?.kind === "image" ? first.url : null,
      videoUrl: first?.kind === "video" ? first.url : null,
      videoPosterUrl: first?.kind === "video" ? first.posterUrl : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: {
        id: row.author.id,
        name: row.author.name,
        imageUrl: this.authorAvatarUrl(row.author.profileImageFilename),
      },
      likeCount: extras?.likeCount ?? 0,
      likedByMe: extras?.likedByMe ?? false,
    };
  }

  private escapeLikePattern(raw: string): string {
    return raw.replace(/!/g, "!!").replace(/%/g, "!%").replace(/_/g, "!_");
  }

  private async getLikeAggregates(
    postIds: number[],
    viewerId?: number,
  ): Promise<Map<number, PostLikeState>> {
    const map = new Map<number, PostLikeState>();
    for (const id of postIds) {
      map.set(id, { likeCount: 0, likedByMe: false });
    }
    if (postIds.length === 0) return map;

    const db = this.db();
    const countRows = await db
      .select({
        postId: postLike.postId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(postLike)
      .where(inArray(postLike.postId, postIds))
      .groupBy(postLike.postId);

    for (const row of countRows) {
      const cur = map.get(row.postId);
      if (cur) cur.likeCount = row.cnt;
    }

    if (viewerId != null) {
      const likedRows = await db
        .select({ postId: postLike.postId })
        .from(postLike)
        .where(
          and(
            eq(postLike.userId, viewerId),
            inArray(postLike.postId, postIds),
          ),
        );
      for (const row of likedRows) {
        const cur = map.get(row.postId);
        if (cur) cur.likedByMe = true;
      }
    }

    return map;
  }

  async getLikeState(postId: number, userId: number): Promise<PostLikeState> {
    const db = this.db();
    const [likeCountRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(postLike)
      .where(eq(postLike.postId, postId));
    const likeCount = likeCountRow?.n ?? 0;
    const [mine] = await db
      .select({ id: postLike.id })
      .from(postLike)
      .where(
        and(eq(postLike.userId, userId), eq(postLike.postId, postId)),
      )
      .limit(1);
    return { likeCount, likedByMe: Boolean(mine) };
  }

  private encodePostListCursor(row: { id: number; createdAt: Date }): string {
    return Buffer.from(
      JSON.stringify({ c: row.createdAt.toISOString(), i: row.id }),
      "utf8",
    ).toString("base64url");
  }

  private decodePostListCursor(cursor: string): { createdAt: Date; id: number } {
    try {
      const json: unknown = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf8"),
      );
      if (json === null || typeof json !== "object") throw new Error();
      const rec = json as { c?: unknown; i?: unknown };
      const id = Number(rec.i);
      const createdAt = new Date(String(rec.c));
      if (!Number.isFinite(id) || id < 1 || Number.isNaN(createdAt.getTime())) {
        throw new Error();
      }
      return { createdAt, id };
    } catch {
      throw new HttpError(400, "유효하지 않은 cursor입니다.");
    }
  }

  async findPage(
    take: number,
    viewerId: number | undefined,
    search: string | undefined,
    category: string | undefined,
    cursor?: string | null,
  ): Promise<{
    items: PostPublic[];
    nextCursor: string | null;
    hasMore: boolean;
    total?: number;
  }> {
    const raw = search?.trim() ?? "";
    const term =
      raw.length > PostsService.SEARCH_MAX_LEN
        ? raw.slice(0, PostsService.SEARCH_MAX_LEN)
        : raw;
    const catFilter = category?.trim()
      ? normalizePostCategory(category.trim())
      : undefined;

    const db = this.db();
    const conds: SQL[] = [];
    if (term.length > 0) {
      const pattern = `%${this.escapeLikePattern(term)}%`;
      conds.push(
        sql`(${post.title} LIKE ${pattern} ESCAPE '!') OR (${post.content} LIKE ${pattern} ESCAPE '!')`,
      );
    }
    if (catFilter) {
      conds.push(eq(post.category, catFilter));
    }
    if (cursor?.trim()) {
      const { createdAt, id } = this.decodePostListCursor(cursor.trim());
      conds.push(
        sql`(${post.createdAt} < ${createdAt} OR (${post.createdAt} = ${createdAt} AND ${post.id} < ${id}))`,
      );
    }
    const whereExpr = conds.length ? and(...conds) : undefined;

    const idRows = await db
      .select({ id: post.id, createdAt: post.createdAt })
      .from(post)
      .where(whereExpr)
      .orderBy(desc(post.createdAt), desc(post.id))
      .limit(take + 1);

    const hasMore = idRows.length > take;
    const pageRows = hasMore ? idRows.slice(0, take) : idRows;
    const ids = pageRows.map((p) => p.id);

    let total: number | undefined;
    if (!cursor?.trim()) {
      const [tr] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(post)
        .where(whereExpr);
      total = tr?.n ?? 0;
    }

    if (ids.length === 0) {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
        ...(total !== undefined ? { total } : {}),
      };
    }

    const postsRaw = await db.query.post.findMany({
      where: inArray(post.id, ids),
      with: {
        author: true,
        attachments: { orderBy: asc(postAttachment.sortOrder) },
      },
    });
    const byId = new Map(postsRaw.map((p) => [p.id, p]));
    const ordered = ids.map((id) => byId.get(id)!);
    const agg = await this.getLikeAggregates(ids, viewerId);

    const last = pageRows[pageRows.length - 1];
    const nextCursor = hasMore ? this.encodePostListCursor(last) : null;

    return {
      items: ordered.map((p) =>
        this.toPublic(
          {
            id: p.id,
            title: p.title,
            content: p.content,
            category: p.category,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            author: {
              id: p.author.id,
              name: p.author.name,
              profileImageFilename: p.author.profileImageFilename ?? null,
            },
            attachments: p.attachments as AttachmentRow[],
          },
          agg.get(p.id),
        ),
      ),
      nextCursor,
      hasMore,
      ...(total !== undefined ? { total } : {}),
    };
  }

  async findOne(id: number, viewerId?: number): Promise<PostPublic> {
    const db = this.db();
    const row = await db.query.post.findFirst({
      where: eq(post.id, id),
      with: {
        author: true,
        attachments: { orderBy: asc(postAttachment.sortOrder) },
      },
    });
    if (!row) throw new HttpError(404, "Not Found");
    const agg = await this.getLikeAggregates([id], viewerId);
    return this.toPublic(
      {
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        author: {
          id: row.author.id,
          name: row.author.name,
          profileImageFilename: row.author.profileImageFilename ?? null,
        },
        attachments: row.attachments as AttachmentRow[],
      },
      agg.get(id)!,
    );
  }

  private validateAttachmentFileSizes(files: UploadedPostFile[]): void {
    for (const f of files) {
      const k = PostsService.multerKind(f);
      if (!k) {
        throw new HttpError(400, "지원하지 않는 첨부 형식입니다.");
      }
      if (k === "image" && f.size > POST_MEDIA_IMAGE_MAX_BYTES) {
        throw new HttpError(400, "이미지 첨부는 파일당 5MB 이하여야 합니다.");
      }
    }
  }

  async createWithAttachments(
    authorId: number,
    titleRaw: string,
    contentRaw: string,
    categoryRaw: string | undefined,
    attachmentFiles: UploadedPostFile[],
    posterFiles: UploadedPostFile[],
  ): Promise<PostPublic> {
    const title = titleRaw?.trim();
    if (!title) {
      throw new HttpError(400, "제목이 필요합니다.");
    }
    if (attachmentFiles.length > POST_ATTACHMENTS_MAX_COUNT) {
      throw new HttpError(
        400,
        `첨부는 최대 ${POST_ATTACHMENTS_MAX_COUNT}개까지 가능합니다.`,
      );
    }
    const rawContent = contentRaw ?? "";
    if (rawContent.length > PostsService.POST_CONTENT_MAX) {
      throw new HttpError(400, "본문이 너무 깁니다.");
    }
    const content = sanitizePostContentHtml(rawContent);
    if (postContentPlainLength(content) === 0) {
      throw new HttpError(400, "본문이 비어 있습니다.");
    }

    this.validateAttachmentFileSizes(attachmentFiles);
    for (const p of posterFiles) {
      if (p.size > POST_MEDIA_POSTER_MAX_BYTES) {
        throw new HttpError(400, "동영상 썸네일은 파일당 2MB 이하여야 합니다.");
      }
    }

    const videoCount = attachmentFiles.filter(
      (f) => PostsService.multerKind(f) === "video",
    ).length;
    if (posterFiles.length !== videoCount) {
      throw new HttpError(
        400,
        `첨부 동영상이 ${videoCount}개이면 posters도 ${videoCount}개를 보내 주세요. (썸네일이 없으면 1×1 JPEG 등 작은 이미지로 채울 수 있습니다.)`,
      );
    }

    const category = normalizePostCategory(categoryRaw);
    const db = this.db();

    const [saved] = await db
      .insert(post)
      .values({
        title,
        content,
        category,
        authorId,
      })
      .returning();

    let posterIdx = 0;
    for (let i = 0; i < attachmentFiles.length; i++) {
      const f = attachmentFiles[i];
      const kind = PostsService.multerKind(f)!;
      let posterFilename: string | null = null;
      if (kind === "video") {
        posterFilename = posterFiles[posterIdx++].filename;
      }
      await db.insert(postAttachment).values({
        postId: saved.id,
        sortOrder: i,
        kind,
        fileFilename: f.filename,
        posterFilename,
      });
    }

    const withAll = await db.query.post.findFirst({
      where: eq(post.id, saved.id),
      with: {
        author: true,
        attachments: { orderBy: asc(postAttachment.sortOrder) },
      },
    });
    if (!withAll) throw new HttpError(500, "Internal server error");

    const likeState = await this.getLikeState(saved.id, authorId);
    return this.toPublic(
      {
        id: withAll.id,
        title: withAll.title,
        content: withAll.content,
        category: withAll.category,
        createdAt: withAll.createdAt,
        updatedAt: withAll.updatedAt,
        author: {
          id: withAll.author.id,
          name: withAll.author.name,
          profileImageFilename: withAll.author.profileImageFilename ?? null,
        },
        attachments: withAll.attachments as AttachmentRow[],
      },
      likeState,
    );
  }

  async updatePost(
    actor: AuthActor,
    id: number,
    body: {
      title?: string;
      content?: string;
      category?: string;
      clearAllMedia?: boolean;
      mediaPlan?: MediaPlanItem[];
      newFiles?: UploadedPostFile[];
      newPosters?: UploadedPostFile[];
    },
  ): Promise<PostPublic> {
    const db = this.db();
    const row = await db.query.post.findFirst({
      where: eq(post.id, id),
      with: {
        author: true,
        attachments: { orderBy: asc(postAttachment.sortOrder) },
      },
    });
    if (!row) throw new HttpError(404, "Not Found");
    if (!canMutateOwnedResource(actor, row.author.id)) {
      throw new HttpError(403, "Forbidden");
    }

    const newFiles = body.newFiles ?? [];
    const newPosters = body.newPosters ?? [];
    this.validateAttachmentFileSizes(newFiles);
    for (const p of newPosters) {
      if (p.size > POST_MEDIA_POSTER_MAX_BYTES) {
        throw new HttpError(400, "동영상 썸네일은 파일당 2MB 이하여야 합니다.");
      }
    }

    const current = this.sortedAttachments(row.attachments as AttachmentRow[]);

    if (body.clearAllMedia) {
      await this.deleteAllAttachments(id);
    } else if (body.mediaPlan !== undefined) {
      const items = body.mediaPlan;
      if (items.length > POST_ATTACHMENTS_MAX_COUNT) {
        throw new HttpError(
          400,
          `첨부는 최대 ${POST_ATTACHMENTS_MAX_COUNT}개까지 가능합니다.`,
        );
      }

      if (items.length === 0) {
        await this.deleteAllAttachments(id);
      } else {
        const keptIds = new Set<number>();
        for (const it of items) {
          if (it.t === "e") keptIds.add(it.id);
        }

        for (const a of current) {
          if (!keptIds.has(a.id)) {
            await this.unlinkAttachmentRow(a);
            await db.delete(postAttachment).where(eq(postAttachment.id, a.id));
          }
        }

        const remaining = await db
          .select()
          .from(postAttachment)
          .where(eq(postAttachment.postId, id))
          .orderBy(asc(postAttachment.sortOrder));
        const byId = new Map(remaining.map((a) => [a.id, a]));

        const newVideoCount = items
          .filter((it): it is { t: "n"; i: number } => it.t === "n")
          .map((it) => newFiles[it.i])
          .filter((f) => f && PostsService.multerKind(f) === "video").length;
        if (newPosters.length !== newVideoCount) {
          throw new HttpError(
            400,
            `새 동영상이 ${newVideoCount}개이면 newPosters도 ${newVideoCount}개가 필요합니다.`,
          );
        }

        let posterIdx = 0;
        let order = 0;
        for (const it of items) {
          if (it.t === "e") {
            const att = byId.get(it.id);
            if (!att || att.postId !== id) {
              throw new HttpError(400, "잘못된 첨부 id입니다.");
            }
            await db
              .update(postAttachment)
              .set({ sortOrder: order++ })
              .where(eq(postAttachment.id, att.id));
          } else {
            const f = newFiles[it.i];
            if (!f) {
              throw new HttpError(400, "새 첨부 파일이 부족합니다.");
            }
            const kind = PostsService.multerKind(f);
            if (!kind) {
              throw new HttpError(400, "지원하지 않는 새 첨부 형식입니다.");
            }
            let posterFilename: string | null = null;
            if (kind === "video") {
              posterFilename = newPosters[posterIdx++].filename;
            }
            await db.insert(postAttachment).values({
              postId: id,
              sortOrder: order++,
              kind,
              fileFilename: f.filename,
              posterFilename,
            });
          }
        }
      }
    }

    const patch: Partial<{
      title: string;
      content: string;
      category: string;
      updatedAt: Date;
    }> = {};
    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) throw new HttpError(400, "제목이 비어 있을 수 없습니다.");
      patch.title = t;
    }
    if (body.content !== undefined) {
      const raw = body.content;
      if (raw.length > PostsService.POST_CONTENT_MAX) {
        throw new HttpError(400, "본문이 너무 깁니다.");
      }
      const cleaned = sanitizePostContentHtml(raw);
      if (postContentPlainLength(cleaned) === 0) {
        throw new HttpError(400, "본문이 비어 있습니다.");
      }
      patch.content = cleaned;
    }
    if (body.category !== undefined) {
      patch.category = normalizePostCategory(body.category);
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = new Date();
      await db.update(post).set(patch).where(eq(post.id, id));
    }

    const refreshed = await db.query.post.findFirst({
      where: eq(post.id, id),
      with: {
        author: true,
        attachments: { orderBy: asc(postAttachment.sortOrder) },
      },
    });
    if (!refreshed) throw new HttpError(500, "Internal server error");

    const likeState = await this.getLikeState(id, actor.id);
    return this.toPublic(
      {
        id: refreshed.id,
        title: refreshed.title,
        content: refreshed.content,
        category: refreshed.category,
        createdAt: refreshed.createdAt,
        updatedAt: refreshed.updatedAt,
        author: {
          id: refreshed.author.id,
          name: refreshed.author.name,
          profileImageFilename: refreshed.author.profileImageFilename ?? null,
        },
        attachments: refreshed.attachments as AttachmentRow[],
      },
      likeState,
    );
  }

  async remove(actor: AuthActor, id: number): Promise<void> {
    const db = this.db();
    const row = await db.query.post.findFirst({
      where: eq(post.id, id),
      with: {
        author: true,
        attachments: { orderBy: asc(postAttachment.sortOrder) },
      },
    });
    if (!row) throw new HttpError(404, "Not Found");
    if (!canMutateOwnedResource(actor, row.author.id)) {
      throw new HttpError(403, "Forbidden");
    }
    for (const a of this.sortedAttachments(row.attachments as AttachmentRow[])) {
      await this.unlinkAttachmentRow(a);
    }
    await db.delete(postComment).where(eq(postComment.postId, id));
    await db.delete(postLike).where(eq(postLike.postId, id));
    await db.delete(postAttachment).where(eq(postAttachment.postId, id));
    await db.delete(post).where(eq(post.id, id));
  }

  async addLike(userId: number, postId: number): Promise<PostLikeState> {
    const db = this.db();
    const exists = await db.query.post.findFirst({
      where: eq(post.id, postId),
      columns: { id: true },
    });
    if (!exists) throw new HttpError(404, "Not Found");

    try {
      await db.insert(postLike).values({ userId, postId });
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      if (msg !== "23505") throw e;
    }
    return this.getLikeState(postId, userId);
  }

  async removeLike(userId: number, postId: number): Promise<PostLikeState> {
    const db = this.db();
    const exists = await db.query.post.findFirst({
      where: eq(post.id, postId),
      columns: { id: true },
    });
    if (!exists) throw new HttpError(404, "Not Found");
    await db
      .delete(postLike)
      .where(and(eq(postLike.userId, userId), eq(postLike.postId, postId)));
    return this.getLikeState(postId, userId);
  }
}
