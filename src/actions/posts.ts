"use server";

// 글·댓글·좋아요 서버 액션 — 클라이언트는 주로 React Query와 함께 호출
import {
  assertPositiveIntId,
  getUserFromTokenOptional,
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
import type {
  Post,
  PostComment,
  PostLikeState,
  PostsPageResponse,
} from "@/lib/api";
import { HttpError } from "@/server/http/http-error";
import { cleanupPostUploadedFiles } from "@/server/posts/cleanup-uploaded";
import {
  parsePostCreateMultipart,
  parsePostPatchMultipart,
} from "@/server/posts/save-post-files";
import { CommentsService } from "@/server/services/comments.service";
import {
  PostsService,
  type UploadedPostFile,
} from "@/server/services/posts.service";

// 수정 폼에서 미디어 순서·유지 여부를 JSON 문자열로 넘김
function parseMediaPlan(
  mediaPlanRaw: string | undefined,
): Array<{ t: "e"; id: number } | { t: "n"; i: number }> | undefined {
  if (!mediaPlanRaw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(mediaPlanRaw) as { items?: unknown };
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new HttpError(400, "mediaPlan.items 가 필요합니다.");
    }
    return parsed.items.map((x: unknown) => {
      if (!x || typeof x !== "object") throw new Error();
      const o = x as { t?: string; id?: number; i?: number };
      if (o.t === "e" && typeof o.id === "number")
        return { t: "e" as const, id: o.id }; // 기존 첨부
      if (o.t === "n" && typeof o.i === "number")
        return { t: "n" as const, i: o.i }; // 새 파일 인덱스
      throw new Error();
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(
      400,
      'mediaPlan 형식이 올바르지 않습니다. 예: {"items":[{"t":"e","id":1},{"t":"n","i":0}]}',
    );
  }
}

// 커서 기반 페이지네이션; 토큰 있으면 좋아요 여부 등 개인화
export async function listPostsAction(
  accessToken: string | null | undefined,
  params?: {
    cursor?: string;
    take?: number;
    search?: string;
    category?: string;
  },
): Promise<PostsPageResponse> {
  try {
    const takeRaw = Number(params?.take ?? 12);
    const take = Math.min(50, Math.max(1, takeRaw)); // 서버 상한
    const search = params?.search?.trim();
    const category = params?.category?.trim();
    const cursor = params?.cursor;
    const user = await getUserFromTokenOptional(accessToken);
    const posts = new PostsService();
    return (await posts.findPage(
      take,
      user?.sub,
      search ?? undefined,
      category ?? undefined,
      cursor ?? undefined,
    )) as unknown as PostsPageResponse;
  } catch (e) {
    rethrowActionError(e, "posts-actions");
  }
}

export async function getPostAction(
  accessToken: string | null | undefined,
  postId: number,
): Promise<Post> {
  try {
    const id = assertPositiveIntId(postId);
    const user = await getUserFromTokenOptional(accessToken);
    const posts = new PostsService();
    return (await posts.findOne(id, user?.sub)) as unknown as Post;
  } catch (e) {
    rethrowActionError(e, "posts-actions");
  }
}

// 댓글 트리(대댓글) 공개 조회
export async function fetchPostCommentsAction(
  postId: number,
): Promise<PostComment[]> {
  try {
    const id = assertPositiveIntId(postId);
    const comments = new CommentsService();
    return (await comments.findTreeByPostId(id)) as unknown as PostComment[];
  } catch (e) {
    rethrowActionError(e, "posts-actions");
  }
}

export async function createPostCommentAction(
  accessToken: string | null | undefined,
  postId: number,
  input: { content: string; parentId?: number },
): Promise<PostComment> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(postId);
    const comments = new CommentsService();
    return (await comments.create(id, user.sub, {
      content: input.content,
      parentId: input.parentId ?? undefined,
    })) as unknown as PostComment;
  } catch (e) {
    rethrowActionError(e, "posts-actions");
  }
}

export async function deletePostCommentAction(
  accessToken: string | null | undefined,
  postId: number,
  commentId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    const pid = assertPositiveIntId(postId);
    const cid = assertPositiveIntId(commentId);
    const comments = new CommentsService();
    await comments.remove(pid, cid, { id: user.sub, role: user.role });
  } catch (e) {
    rethrowActionError(e, "posts-actions");
  }
}

export async function likePostAction(
  accessToken: string | null | undefined,
  postId: number,
): Promise<PostLikeState> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(postId);
    const posts = new PostsService();
    return await posts.addLike(user.sub, id);
  } catch (e) {
    rethrowActionError(e, "posts-actions");
  }
}

export async function unlikePostAction(
  accessToken: string | null | undefined,
  postId: number,
): Promise<PostLikeState> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(postId);
    const posts = new PostsService();
    return await posts.removeLike(user.sub, id);
  } catch (e) {
    rethrowActionError(e, "posts-actions");
  }
}

export async function createPostAction(
  accessToken: string | null | undefined,
  formData: FormData,
): Promise<Post> {
  let toClean: UploadedPostFile[] = []; // 실패 시 디스크 롤백 목록
  try {
    const user = await requireUserFromToken(accessToken);
    const parsed = await parsePostCreateMultipart(formData);
    toClean = [...parsed.attachmentFiles, ...parsed.posterFiles];
    const posts = new PostsService();
    return (await posts.createWithAttachments(
      user.sub,
      parsed.title,
      parsed.content,
      parsed.category,
      parsed.attachmentFiles,
      parsed.posterFiles,
    )) as unknown as Post;
  } catch (e) {
    await cleanupPostUploadedFiles(toClean);
    rethrowActionError(e, "posts-actions");
  }
}

export async function updatePostAction(
  accessToken: string | null | undefined,
  postId: number,
  formData: FormData,
): Promise<Post> {
  let toClean: UploadedPostFile[] = [];
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(postId);
    const body = await parsePostPatchMultipart(formData);
    toClean = [...body.newFiles, ...body.newPosters];

    const clearAllMedia =
      body.newFiles.length === 0 &&
      !body.mediaPlanRaw?.trim() &&
      body.removeMedia === true;

    const mediaPlan = parseMediaPlan(body.mediaPlanRaw);

    const posts = new PostsService();
    return (await posts.updatePost(
      { id: user.sub, role: user.role },
      id,
      {
        title: body.title,
        content: body.content,
        category: body.category,
        clearAllMedia: clearAllMedia || undefined,
        mediaPlan,
        newFiles: body.newFiles,
        newPosters: body.newPosters,
      },
    )) as unknown as Post;
  } catch (e) {
    await cleanupPostUploadedFiles(toClean);
    rethrowActionError(e, "posts-actions");
  }
}

export async function deletePostAction(
  accessToken: string | null | undefined,
  postId: number,
): Promise<void> {
  try {
    const user = await requireUserFromToken(accessToken);
    const id = assertPositiveIntId(postId);
    const posts = new PostsService();
    await posts.remove({ id: user.sub, role: user.role }, id);
  } catch (e) {
    rethrowActionError(e, "posts-actions");
  }
}
