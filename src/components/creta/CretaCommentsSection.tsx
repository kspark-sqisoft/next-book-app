"use client";

// 커뮤니티 댓글(2단: 댓글 + 답글) — 북·플레이리스트 상세 아래에서 의견을 나눈다.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  countCretaComments,
  createCretaComment,
  type CretaComment,
  type CretaCommentTargetKind,
  deleteCretaComment,
  fetchCretaComments,
} from "@/features/creta/creta-comments-api";
import { canEditAsOwnerOrAdmin } from "@/lib/authz";
import { formatDateMediumShort } from "@/lib/format-date";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

const MAX = 2000;

function CommentForm({
  placeholder,
  pending,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  pending: boolean;
  autoFocus?: boolean;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed || pending) return;
        onSubmit(trimmed);
        setValue("");
      }}
    >
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX))}
        placeholder={placeholder}
        rows={onCancel ? 2 : 3}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && trimmed) {
            e.preventDefault();
            onSubmit(trimmed);
            setValue("");
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {value.length}/{MAX} · Ctrl+Enter로 등록
        </span>
        <div className="flex gap-1.5">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              취소
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={!trimmed || pending}>
            {pending ? (
              <Spinner className="mr-1.5 size-3.5" aria-hidden />
            ) : null}
            {onCancel ? "답글 등록" : "댓글 등록"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function CretaCommentsSection({
  kind,
  targetId,
}: {
  kind: CretaCommentTargetKind;
  targetId: number;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = cretaKeys.comments(kind, targetId);
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const { data: tree = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchCretaComments(kind, targetId),
  });

  const invalidateCounts = () =>
    queryClient.invalidateQueries({
      queryKey: [...cretaKeys.all, "comment-counts", kind],
    });

  const createMutation = useMutation({
    mutationFn: (input: { content: string; parentId?: number | null }) =>
      createCretaComment(kind, targetId, input),
    onSuccess: (next) => {
      queryClient.setQueryData(key, next);
      void invalidateCounts();
      setReplyTo(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => deleteCretaComment(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void invalidateCounts();
      toast.success("댓글을 삭제했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requireLogin = (): boolean => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return false;
    }
    return true;
  };

  const renderComment = (c: CretaComment, depth: 0 | 1) => {
    const canDelete = canEditAsOwnerOrAdmin(user, c.author.id);
    return (
      <li
        key={c.id}
        className={cn(
          "space-y-2 rounded-md",
          depth === 1 && "ml-8 border-l-2 border-border/70 pl-3",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              {depth === 1 ? (
                <CornerDownRight className="size-3 shrink-0" aria-hidden />
              ) : null}
              <AuthorAvatarInline author={c.author} size="xs" />
              <span>· {formatDateMediumShort(c.createdAt)}</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {c.content}
            </p>
          </div>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="댓글 삭제"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(c.id)}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
        {depth === 0 ? (
          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() =>
                requireLogin() && setReplyTo(replyTo === c.id ? null : c.id)
              }
            >
              <CornerDownRight className="size-3.5" aria-hidden />
              답글{c.replies.length > 0 ? ` ${c.replies.length}` : ""}
            </Button>
            {c.replies.length > 0 ? (
              <ul className="space-y-3">
                {c.replies.map((r) => renderComment(r, 1))}
              </ul>
            ) : null}
            {replyTo === c.id ? (
              <div className="ml-8">
                <CommentForm
                  placeholder={`${c.author.name || "회원"}님에게 답글…`}
                  pending={createMutation.isPending}
                  autoFocus
                  onSubmit={(content) =>
                    createMutation.mutate({ content, parentId: c.id })
                  }
                  onCancel={() => setReplyTo(null)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section className="space-y-4" aria-label="댓글">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold">
          댓글{" "}
          <span className="text-muted-foreground">
            {countCretaComments(tree)}
          </span>
        </h2>
      </div>
      {user ? (
        <CommentForm
          placeholder="이 콘텐츠에 대한 의견을 남겨 보세요."
          pending={createMutation.isPending && replyTo == null}
          onSubmit={(content) => createMutation.mutate({ content })}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          댓글을 남기려면 로그인하세요.
        </p>
      )}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-5" />
        </div>
      ) : tree.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          아직 댓글이 없습니다. 첫 의견을 남겨 보세요.
        </p>
      ) : (
        <ul className="space-y-5">{tree.map((c) => renderComment(c, 0))}</ul>
      )}
    </section>
  );
}
