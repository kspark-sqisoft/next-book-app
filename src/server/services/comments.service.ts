import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { post as postTable, postComment } from "@/server/db/schema";
import { AVATARS_SUBDIR } from "@/server/env";
import { type AuthActor, canMutateOwnedResource } from "@/server/auth/auth-policy";
import { HttpError } from "@/server/http/http-error";

export type CommentAuthorPublic = {
  id: number;
  name: string;
  imageUrl: string | null;
};

export type CommentPublic = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: CommentAuthorPublic;
  replies: CommentPublic[];
};

export class CommentsService {
  private static readonly CONTENT_MAX = 8000;

  private db() {
    return getDb();
  }

  private authorAvatarUrl(profileImageFilename: string | null): string | null {
    if (!profileImageFilename) return null;
    return `/uploads/${AVATARS_SUBDIR}/${profileImageFilename}`;
  }

  private toPublic(c: {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: number;
      name: string;
      profileImageFilename: string | null;
    };
    replies: CommentPublic[];
  }): CommentPublic {
    return {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: {
        id: c.author.id,
        name: c.author.name,
        imageUrl: this.authorAvatarUrl(c.author.profileImageFilename),
      },
      replies: c.replies,
    };
  }

  private sortTree(nodes: CommentPublic[]): void {
    nodes.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    for (const n of nodes) this.sortTree(n.replies);
  }

  private buildTree(
    rows: Array<{
      id: number;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      parentId: number | null;
      author: {
        id: number;
        name: string;
        profileImageFilename: string | null;
      };
    }>,
  ): CommentPublic[] {
    const byId = new Map<number, CommentPublic>();
    for (const row of rows) {
      byId.set(
        row.id,
        this.toPublic({
          ...row,
          replies: [],
        }),
      );
    }
    const roots: CommentPublic[] = [];
    for (const row of rows) {
      const node = byId.get(row.id)!;
      const pid = row.parentId;
      if (pid == null) {
        roots.push(node);
      } else {
        const parent = byId.get(pid);
        if (parent) parent.replies.push(node);
        else roots.push(node);
      }
    }
    this.sortTree(roots);
    return roots;
  }

  async findTreeByPostId(postId: number): Promise<CommentPublic[]> {
    const db = this.db();
    const exists = await db.query.post.findFirst({
      where: eq(postTable.id, postId),
      columns: { id: true },
    });
    if (!exists) throw new HttpError(404, "Not Found");

    const rows = await db.query.postComment.findMany({
      where: eq(postComment.postId, postId),
      with: { author: true },
      orderBy: asc(postComment.createdAt),
    });

    const flat = rows.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      parentId: r.parentId,
      author: {
        id: r.author.id,
        name: r.author.name,
        profileImageFilename: r.author.profileImageFilename ?? null,
      },
    }));

    return this.buildTree(flat);
  }

  async create(
    postId: number,
    authorId: number,
    body: { content: string; parentId?: number },
  ): Promise<CommentPublic> {
    const db = this.db();
    const postExists = await db.query.post.findFirst({
      where: eq(postTable.id, postId),
      columns: { id: true },
    });
    if (!postExists) throw new HttpError(404, "Not Found");

    const raw = body.content?.trim() ?? "";
    if (!raw) {
      throw new HttpError(400, "댓글 내용이 필요합니다.");
    }
    if (raw.length > CommentsService.CONTENT_MAX) {
      throw new HttpError(
        400,
        `댓글은 ${CommentsService.CONTENT_MAX}자 이하로 작성해 주세요.`,
      );
    }

    let parentId: number | null = null;
    if (body.parentId != null) {
      const parent = await db.query.postComment.findFirst({
        where: and(
          eq(postComment.id, body.parentId),
          eq(postComment.postId, postId),
        ),
      });
      if (!parent) {
        throw new HttpError(
          400,
          "대댓글 대상이 없거나 이 글에 속하지 않습니다.",
        );
      }
      parentId = parent.id;
    }

    const [saved] = await db
      .insert(postComment)
      .values({
        content: raw,
        postId,
        authorId,
        parentId,
      })
      .returning();

    const withAuthor = await db.query.postComment.findFirst({
      where: eq(postComment.id, saved.id),
      with: { author: true },
    });
    if (!withAuthor) throw new HttpError(500, "Internal server error");

    return this.toPublic({
      id: withAuthor.id,
      content: withAuthor.content,
      createdAt: withAuthor.createdAt,
      updatedAt: withAuthor.updatedAt,
      author: {
        id: withAuthor.author.id,
        name: withAuthor.author.name,
        profileImageFilename: withAuthor.author.profileImageFilename ?? null,
      },
      replies: [],
    });
  }

  async remove(
    postId: number,
    commentId: number,
    actor: AuthActor,
  ): Promise<void> {
    const db = this.db();
    const c = await db.query.postComment.findFirst({
      where: and(
        eq(postComment.id, commentId),
        eq(postComment.postId, postId),
      ),
      with: { author: true },
    });
    if (!c) throw new HttpError(404, "Not Found");
    if (!canMutateOwnedResource(actor, c.author.id)) {
      throw new HttpError(403, "Forbidden");
    }
    await this.deleteCommentSubtree(commentId);
  }

  private async deleteCommentSubtree(commentId: number): Promise<void> {
    const db = this.db();
    const children = await db
      .select({ id: postComment.id })
      .from(postComment)
      .where(eq(postComment.parentId, commentId));
    for (const ch of children) {
      await this.deleteCommentSubtree(ch.id);
    }
    await db.delete(postComment).where(eq(postComment.id, commentId));
  }
}
