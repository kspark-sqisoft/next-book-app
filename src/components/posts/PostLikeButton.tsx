import { Heart } from "lucide-react";
import { type MouseEvent, useOptimistic, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { likePost, type PostLikeState, unlikePost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

type Props = {
  postId: number;
  likeCount: number;
  likedByMe: boolean;
  onApplied: (state: PostLikeState) => void;
  /** 좋아요 토글 시도 직후(낙관적 반영 전) — 목록 등에서 이전 동기화 에러 초기화용 */
  onActionStart?: () => void;
  onSyncError?: (message: string) => void;
  size?: "sm" | "default";
  className?: string;
};

/** `useOptimistic` + `useTransition`: 클릭 직시 UI 반영, 실패 시 자동으로 props 기준으로 복귀 */
export function PostLikeButton({
  postId,
  likeCount,
  likedByMe,
  onApplied,
  onActionStart,
  onSyncError,
  size = "sm",
  className,
}: Props) {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [optimistic, addOptimistic] = useOptimistic(
    { likeCount, likedByMe },
    (current, patch: PostLikeState) => ({ ...current, ...patch }),
  );

  function toggle(ev: MouseEvent<HTMLButtonElement>) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!user || isPending) return;

    onActionStart?.();

    const nextLiked = !likedByMe;
    const nextCount = likeCount + (nextLiked ? 1 : -1);

    startTransition(async () => {
      addOptimistic({ likeCount: nextCount, likedByMe: nextLiked });
      try {
        const state = nextLiked
          ? await likePost(postId)
          : await unlikePost(postId);
        onApplied(state);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "좋아요 처리에 실패했습니다.";
        onSyncError?.(msg);
      }
    });
  }

  return (
    <Button
      type="button"
      variant={optimistic.likedByMe ? "secondary" : "ghost"}
      size={size}
      disabled={!user || isPending}
      className={cn("gap-1.5", className)}
      aria-pressed={optimistic.likedByMe}
      aria-label={optimistic.likedByMe ? "좋아요 취소" : "좋아요"}
      title={user ? undefined : "로그인 후 좋아요할 수 있습니다."}
      onClick={toggle}
    >
      <Heart
        className={cn(
          "size-4 shrink-0",
          optimistic.likedByMe && "fill-primary text-primary",
        )}
        aria-hidden
      />
      <span className="tabular-nums text-xs font-medium">
        {optimistic.likeCount}
      </span>
    </Button>
  );
}
