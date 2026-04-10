"use client";

// 글 상세: 본문 HTML, 미디어, 댓글, 작성자/관리자 삭제
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { PostCommentsSection } from "@/components/posts/PostCommentsSection";
import { PostLikeButton } from "@/components/posts/PostLikeButton";
import { PostMediaCarousel } from "@/components/posts/PostMediaCarousel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deletePost, fetchPost } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { canEditAsOwnerOrAdmin } from "@/lib/authz";
import { formatDateFullShort } from "@/lib/format-date";
import { isPostCategoryId, POST_CATEGORY_LABELS } from "@/lib/post-categories";
import { postBodyHtmlForRender } from "@/lib/post-html";
import { postKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

export function PostDetailPage() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : NaN;
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const viewerKey = user?.sub ?? "anon";
  const detailKey = postKeys.detail(id, viewerKey);

  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    data: post,
    isPending,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: detailKey,
    queryFn: async () => {
      const p = await fetchPost(id);
      appLog("posts", "상세 로드 완료", { id: p.id });
      return p;
    },
    enabled: Number.isFinite(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(id),
    onSuccess: () => {
      appLog("posts", "글 삭제 완료", { id });
      toast.success("글이 삭제되었습니다.");
      void queryClient.invalidateQueries({ queryKey: postKeys.all });
      setDeleteOpen(false);
      router.replace("/posts");
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "삭제에 실패했습니다.";
      toast.error(msg);
      setError(msg);
    },
  });

  useEffect(() => {
    if (!Number.isFinite(id) || !isError) return;
    const msg =
      queryError instanceof Error
        ? queryError.message
        : "글을 불러오지 못했습니다.";
    toast.error(msg);
  }, [id, isError, queryError]);

  if (!Number.isFinite(id)) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message="잘못된 글 번호입니다." />
        <Button asChild variant="outline" size="sm">
          <Link href="/posts">목록으로</Link>
        </Button>
      </div>
    );
  }

  const loadError =
    isError && queryError instanceof Error
      ? queryError.message
      : isError
        ? "글을 불러오지 못했습니다."
        : null;

  if (isError && !post && loadError) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message={loadError} />
        <Button asChild variant="outline" size="sm">
          <Link href="/posts">목록으로</Link>
        </Button>
      </div>
    );
  }

  if (isPending || !post) {
    return <CenteredSpinner className="min-h-0 py-16" />;
  }

  const canMutatePost = canEditAsOwnerOrAdmin(user, post.author.id);

  function onDelete() {
    if (!Number.isFinite(id)) return;
    setError(null);
    deleteMutation.mutate();
  }

  const deleteBusy = deleteMutation.isPending;

  return (
    <article className="space-y-6">
      <FormErrorAlert message={error} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading min-w-0 text-2xl font-semibold tracking-tight">
              {post.title}
            </h1>
            {isPostCategoryId(post.category) ? (
              <Badge variant="secondary">
                {POST_CATEGORY_LABELS[post.category]}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            <AuthorAvatarInline author={post.author} size="md">
              {" "}
              · {formatDateFullShort(post.createdAt)}
            </AuthorAvatarInline>
          </p>
          <div className="mt-3">
            <PostLikeButton
              postId={post.id}
              likeCount={post.likeCount}
              likedByMe={post.likedByMe}
              onApplied={(state) => {
                queryClient.setQueryData(detailKey, (p) =>
                  p
                    ? {
                        ...p,
                        likeCount: state.likeCount,
                        likedByMe: state.likedByMe,
                      }
                    : p,
                );
                void queryClient.invalidateQueries({
                  queryKey: postKeys.lists(),
                });
              }}
              onSyncError={(msg) => {
                toast.error(msg);
                setError(msg);
              }}
            />
          </div>
        </div>
        {canMutatePost ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/posts/${post.id}/edit`}>수정</Link>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              삭제
            </Button>
          </div>
        ) : null}
      </div>

      {post.media?.length ? <PostMediaCarousel items={post.media} /> : null}

      <section aria-label="글 본문" className="space-y-4">
        <div className="flex items-center gap-3 pt-2">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            본문
          </span>
          <div className="h-px min-w-0 flex-1 bg-border" />
        </div>
        <div className="rounded-xl border border-border/90 bg-muted/25 p-5 shadow-sm ring-1 ring-black/[0.03] dark:border-border dark:bg-muted/20 dark:ring-white/[0.05] sm:p-7 md:p-8">
          <div
            className="post-body text-[15px] leading-[1.75] text-foreground sm:text-base sm:leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: postBodyHtmlForRender(post.content),
            }}
          />
        </div>
      </section>

      <PostCommentsSection postId={post.id} user={user} />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-0"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push("/posts");
          }
        }}
      >
        ← 목록
      </Button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 글을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              disabled={deleteBusy}
            >
              {deleteBusy ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
