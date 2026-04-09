import {
  useActionState,
  useEffect,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPostComment,
  deletePostComment,
  fetchPostComments,
  type AuthUser,
  type PostComment,
} from "@/lib/api";
import { postKeys } from "@/lib/query-keys";
import { formatDateMediumShort } from "@/lib/format-date";
import { formDataGetString } from "@/lib/form-data-utils";
import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { appLog } from "@/lib/app-log";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { FormFieldError } from "@/components/forms/FormFieldError";
import { FormStatusSubmitButton } from "@/components/forms/FormStatusSubmitButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { canEditAsOwnerOrAdmin } from "@/lib/authz";

type CommentFormState = {
  error: string | null;
  tick: number;
};

type CommentItemProps = {
  postId: number;
  comment: PostComment;
  depth: number;
  user: AuthUser | null;
  onCommentsInvalidate: () => void;
  onError: (msg: string) => void;
};

function CommentItem({
  postId,
  comment,
  depth,
  user,
  onCommentsInvalidate,
  onError,
}: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [isDeletePending, startDeleteTransition] = useTransition();

  const canDeleteComment = canEditAsOwnerOrAdmin(user, comment.author.id);
  const maxVisualDepth = 14;
  const indent = Math.min(depth, maxVisualDepth);

  const initialReply: CommentFormState = { error: null, tick: 0 };

  async function replyAction(
    prev: CommentFormState,
    formData: FormData,
  ): Promise<CommentFormState> {
    if (!user) {
      return { error: "로그인이 필요합니다.", tick: prev.tick };
    }
    const text = formDataGetString(formData, "content").trim();
    if (!text) {
      return { error: "답글 내용을 입력해 주세요.", tick: prev.tick };
    }
    try {
      await createPostComment(postId, { content: text, parentId: comment.id });
      onCommentsInvalidate();
      appLog("posts", "대댓글 작성", { postId, parentId: comment.id });
      toast.success("답글이 등록되었습니다.");
      setReplyOpen(false);
      return { error: null, tick: prev.tick + 1 };
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "댓글을 저장하지 못했습니다.";
      toast.error(msg);
      return { error: msg, tick: prev.tick };
    }
  }

  const [replyState, replyFormAction] = useActionState(replyAction, initialReply);
  const [optimisticReply, addOptimisticReply] = useOptimistic(
    replyState,
    (current, next: Partial<CommentFormState>) => ({ ...current, ...next }),
  );

  function onDelete() {
    if (!user) return;
    startDeleteTransition(async () => {
      try {
        await deletePostComment(postId, comment.id);
        onCommentsInvalidate();
        appLog("posts", "댓글 삭제", { postId, commentId: comment.id });
        toast.success("댓글이 삭제되었습니다.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "삭제에 실패했습니다.";
        toast.error(msg);
        onError(msg);
      }
    });
  }

  return (
    <div
      className="border-l-2 border-border/70 pl-3"
      style={{ marginLeft: indent > 0 ? Math.min(indent, 10) * 12 : 0 }}
    >
      <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AuthorAvatarInline
            author={comment.author}
            size="sm"
            className="text-sm font-medium text-foreground"
          />
          <time
            className="text-xs text-muted-foreground"
            dateTime={comment.createdAt}
          >
            {formatDateMediumShort(comment.createdAt)}
          </time>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {comment.content}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {user ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setReplyOpen((o) => !o);
              }}
            >
              답글
            </Button>
          ) : null}
          {canDeleteComment ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
              disabled={isDeletePending}
              onClick={() => onDelete()}
            >
              {isDeletePending ? "삭제 중…" : "삭제"}
            </Button>
          ) : null}
        </div>
        {replyOpen && user ? (
          <form
            action={replyFormAction}
            onSubmit={() => addOptimisticReply({ error: null })}
            className="mt-3 space-y-2 border-t border-border/60 pt-3"
          >
            <FormFieldError message={optimisticReply.error} />
            <Textarea
              key={`${comment.id}-reply-${replyState.tick}`}
              name="content"
              placeholder={`${comment.author.name}님에게 답글…`}
              rows={3}
              className="min-h-18 resize-y text-sm"
              required
            />
            <div className="flex gap-2">
              <FormStatusSubmitButton size="sm" pendingLabel="등록 중…">
                답글 등록
              </FormStatusSubmitButton>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setReplyOpen(false);
                }}
              >
                취소
              </Button>
            </div>
          </form>
        ) : null}
      </div>
      {comment.replies.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {comment.replies.map((r) => (
            <li key={r.id}>
              <CommentItem
                postId={postId}
                comment={r}
                depth={depth + 1}
                user={user}
                onCommentsInvalidate={onCommentsInvalidate}
                onError={onError}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type PostCommentsSectionProps = {
  postId: number;
  user: AuthUser | null;
};

export function PostCommentsSection({ postId, user }: PostCommentsSectionProps) {
  const queryClient = useQueryClient();
  const commentsKey = postKeys.comments(postId);

  const [sectionError, setSectionError] = useState<string | null>(null);

  const invalidateComments = () => {
    void queryClient.invalidateQueries({ queryKey: commentsKey });
  };

  const {
    data: tree = [],
    isPending: loading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: commentsKey,
    queryFn: async () => {
      const data = await fetchPostComments(postId);
      appLog("posts", "댓글 트리 로드", { postId, count: flattenCount(data) });
      return data;
    },
  });

  const error =
    isError && queryError instanceof Error
      ? queryError.message
      : isError
        ? "댓글을 불러오지 못했습니다."
        : null;

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  const initialRoot: CommentFormState = { error: null, tick: 0 };

  async function rootCommentAction(
    prev: CommentFormState,
    formData: FormData,
  ): Promise<CommentFormState> {
    if (!user) {
      return { error: "로그인이 필요합니다.", tick: prev.tick };
    }
    const text = formDataGetString(formData, "content").trim();
    if (!text) {
      return { error: "댓글 내용을 입력해 주세요.", tick: prev.tick };
    }
    try {
      await createPostComment(postId, { content: text });
      invalidateComments();
      appLog("posts", "댓글 작성", { postId });
      toast.success("댓글이 등록되었습니다.");
      return { error: null, tick: prev.tick + 1 };
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "댓글을 저장하지 못했습니다.";
      toast.error(msg);
      return { error: msg, tick: prev.tick };
    }
  }

  const [rootState, rootFormAction] = useActionState(rootCommentAction, initialRoot);
  const [optimisticRoot, addOptimisticRoot] = useOptimistic(
    rootState,
    (current, next: Partial<CommentFormState>) => ({ ...current, ...next }),
  );

  const displayError = sectionError ?? error;

  return (
    <section className="border-t border-border pt-8" aria-label="댓글">
      <h2 className="font-heading text-lg font-semibold tracking-tight">댓글</h2>

      <FormErrorAlert message={displayError} className="mt-4" />

      {user ? (
        <form
          action={rootFormAction}
          onSubmit={() => {
            addOptimisticRoot({ error: null });
            setSectionError(null);
          }}
          className="mt-4 space-y-2"
        >
          <FormFieldError message={optimisticRoot.error} />
          <Textarea
            key={`root-${rootState.tick}`}
            name="content"
            placeholder="댓글을 입력하세요…"
            rows={4}
            className="min-h-24 resize-y text-sm"
            required
          />
          <FormStatusSubmitButton size="sm" pendingLabel="등록 중…">
            댓글 등록
          </FormStatusSubmitButton>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          댓글을 남기려면 로그인하세요.
        </p>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-7 text-muted-foreground" />
          </div>
        ) : isError ? null : tree.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 댓글이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {tree.map((c) => (
              <li key={c.id}>
                <CommentItem
                  postId={postId}
                  comment={c}
                  depth={0}
                  user={user}
                  onCommentsInvalidate={invalidateComments}
                  onError={setSectionError}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function flattenCount(nodes: PostComment[]): number {
  let n = 0;
  for (const x of nodes) {
    n += 1 + flattenCount(x.replies);
  }
  return n;
}
