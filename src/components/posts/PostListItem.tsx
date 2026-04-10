// 글 목록 카드: 요약·카테고리·좋아요
import { Video } from "lucide-react";
import Link from "next/link";

import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { PostLikeButton } from "@/components/posts/PostLikeButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import type { Post, PostLikeState } from "@/lib/api";
import { formatDateMediumShort } from "@/lib/format-date";
import { isPostCategoryId, POST_CATEGORY_LABELS } from "@/lib/post-categories";
import { plainTextFromPostHtml } from "@/lib/post-html";

type Props = {
  post: Post;
  onLikeInteractionStart: () => void;
  onLikeApplied: (postId: number, state: PostLikeState) => void;
  onLikeSyncError: (message: string) => void;
};

export function PostListItem({
  post,
  onLikeInteractionStart,
  onLikeApplied,
  onLikeSyncError,
}: Props) {
  const sideMedia = (post.media?.length ?? 0) > 0;
  const thumbUrl = post.coverThumbUrl;

  const likeButton = (
    <PostLikeButton
      postId={post.id}
      likeCount={post.likeCount}
      likedByMe={post.likedByMe}
      className="h-8 border border-border/40 bg-background/35 text-foreground shadow-sm backdrop-blur-md hover:bg-background/50"
      onActionStart={onLikeInteractionStart}
      onApplied={(state) => onLikeApplied(post.id, state)}
      onSyncError={onLikeSyncError}
    />
  );

  return (
    <li>
      <Card className="group/card relative !gap-0 overflow-hidden !p-0 !py-0 transition-colors hover:bg-muted/30">
        <div className="relative min-h-[7.5rem] w-full overflow-hidden rounded-xl">
          {sideMedia && thumbUrl ? (
            <>
              {/* 썸네일은 그대로 보이게 두고, 위 스크림만 옅게(이전: img opacity + card/95 이중으로 거의 안 보임) */}
              <SafeImage
                src={thumbUrl}
                alt=""
                className="pointer-events-none absolute inset-0 z-0 size-full object-cover saturate-[0.95]"
                loading="lazy"
                placeholderLabel={`「${post.title}」 목록 배경`}
              />
              <div
                className="pointer-events-none absolute inset-0 z-1 bg-linear-to-r from-card/82 via-card/48 to-card/28 dark:from-card/85 dark:via-card/52 dark:to-card/32"
                aria-hidden
              />
            </>
          ) : sideMedia ? (
            <div
              className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-muted/35 text-muted-foreground/20 dark:bg-muted/25 dark:text-muted-foreground/15"
              aria-hidden
            >
              <Video className="size-24" strokeWidth={1} />
            </div>
          ) : null}

          <div className="relative z-10 min-h-[7.5rem] min-w-0">
            <Link
              href={`/posts/${post.id}`}
              className="flex min-h-[7.5rem] min-w-0 flex-col justify-center gap-1.5 px-4 py-3 pb-10 pr-14 sm:py-3.5"
            >
              <div className="flex min-h-6 shrink-0 flex-wrap items-center gap-2">
                <h3 className="font-heading line-clamp-1 min-w-0 flex-1 text-base font-semibold leading-6 text-foreground transition-colors group-hover/card:text-primary">
                  {post.title}
                </h3>
                {isPostCategoryId(post.category) ? (
                  <Badge
                    variant="secondary"
                    className="shrink-0 text-[10px] font-medium"
                  >
                    {POST_CATEGORY_LABELS[post.category]}
                  </Badge>
                ) : null}
              </div>
              <p className="flex h-8 min-h-8 shrink-0 items-center text-xs text-muted-foreground">
                <AuthorAvatarInline author={post.author} size="xs">
                  {" "}
                  · {formatDateMediumShort(post.createdAt)}
                </AuthorAvatarInline>
              </p>
              <p className="line-clamp-2 h-10 max-h-10 shrink-0 overflow-hidden text-sm leading-5 break-words text-muted-foreground">
                {plainTextFromPostHtml(post.content)}
              </p>
            </Link>
            <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-end p-2">
              <div className="pointer-events-auto">{likeButton}</div>
            </div>
          </div>
        </div>
      </Card>
    </li>
  );
}
