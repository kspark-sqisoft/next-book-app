"use client";

// 커뮤니티 좋아요 버튼 — 하트 + 개수. 누르면 토글, 비로그인은 안내 토스트.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import type { CretaCommentTargetKind } from "@/lib/creta-comments-api";
import { type CretaLikeState, toggleCretaLike } from "@/lib/creta-likes-api";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

export function CretaLikeButton({
  kind,
  targetId,
  state,
  size = "sm",
  variant = "default",
  className,
}: {
  kind: CretaCommentTargetKind;
  targetId: number;
  /** 아직 로드 전이면 undefined → 0으로 표시 */
  state: CretaLikeState | undefined;
  size?: "sm" | "md";
  /** overlay = 썸네일 위 어두운 배지(댓글 수 배지와 같은 톤) */
  variant?: "default" | "overlay";
  className?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const liked = Boolean(state?.likedByMe);
  const count = state?.count ?? 0;

  const mutation = useMutation({
    mutationFn: () => toggleCretaLike(kind, targetId),
    onSuccess: (next) => {
      // 이 대상이 포함된 모든 좋아요 쿼리에 반영(목록·상세 공통)
      queryClient.setQueriesData<Record<number, CretaLikeState>>(
        { queryKey: [...cretaKeys.all, "likes", kind] },
        (old) => (old && targetId in old ? { ...old, [targetId]: next } : old),
      );
      void queryClient.invalidateQueries({
        queryKey: [...cretaKeys.all, "likes", kind],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      disabled={mutation.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          toast.error("좋아요는 로그인 후 누를 수 있습니다.");
          return;
        }
        mutation.mutate();
      }}
      className={cn(
        "inline-flex items-center gap-1 transition-colors disabled:opacity-70",
        variant === "overlay"
          ? cn(
              "rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-black/75",
              liked && "text-rose-300",
            )
          : cn(
              "rounded-full border",
              size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm",
              liked
                ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            ),
        className,
      )}
    >
      <Heart
        className={cn(
          variant === "overlay"
            ? "size-3"
            : size === "sm"
              ? "size-3.5"
              : "size-4",
          liked && "fill-current",
        )}
        aria-hidden
      />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
