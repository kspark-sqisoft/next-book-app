import { BookMarked, Share2, Trash2 } from "lucide-react";
import Link from "next/link";

import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import type { BookListItem as BookListItemType } from "@/lib/api";
import { formatDateMediumShort } from "@/lib/format-date";

type Props = {
  book: BookListItemType;
  /** `useBookPageThumbnails` 등으로 만든 첫 슬라이드 PNG data URL */
  coverThumbDataUrl: string | null | undefined;
  /** 있으면 카드에 삭제 버튼 표시(작성자·관리자) — 확인 다이얼로그는 호출측 책임 */
  onDelete?: () => void;
};

/** 공유 대상 요약: "A, B, C 외 2명" */
function sharedWithLabel(
  users: { id: number; name: string }[],
  max = 3,
): string {
  const names = users.map((u) => u.name.trim() || "이름 없음");
  const head = names.slice(0, max).join(", ");
  const rest = names.length - max;
  return rest > 0 ? `${head} 외 ${rest}명` : head;
}

/** 북 카드 — 커뮤니티·플레이리스트 카드와 같은 세로형(16:9 커버 + 제목 + 작성자) */
export function BookListItem({ book, coverThumbDataUrl, onDelete }: Props) {
  const sharedWith = book.sharedWith ?? [];
  const bg = book.coverPreview?.backgroundColor;

  return (
    <li>
      <Card className="group/card relative h-full gap-3 py-4 transition-colors hover:border-primary/50">
        <CardContent className="space-y-3 px-4">
          <Link
            href={`/books/${book.id}`}
            className="block space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div
              className="relative aspect-video overflow-hidden rounded-lg bg-muted/40"
              style={bg ? { backgroundColor: bg } : undefined}
            >
              {coverThumbDataUrl ? (
                <SafeImage
                  src={coverThumbDataUrl}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                  placeholderLabel={`「${book.title}」 첫 슬라이드`}
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-muted-foreground/30"
                  aria-hidden
                >
                  <BookMarked className="size-12" strokeWidth={1.25} />
                </div>
              )}
              <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
                페이지 {book.pageCount}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-heading flex items-center gap-1.5 truncate text-sm font-semibold transition-colors group-hover/card:text-primary">
                <span className="truncate">{book.title}</span>
                {book.status === "draft" ? (
                  <span className="shrink-0 rounded-full bg-zinc-500/15 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                    작성 중
                  </span>
                ) : book.status === "review" ? (
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    검토 중
                  </span>
                ) : null}
              </p>
              <p className="mt-1 flex min-h-5 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                <AuthorAvatarInline author={book.author} size="xs">
                  {" "}
                  · {formatDateMediumShort(book.updatedAt)}
                </AuthorAvatarInline>
              </p>
              {book.sharedToAll ? (
                <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-primary">
                  <Share2 className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">모든 사용자에게 공유됨</span>
                </p>
              ) : sharedWith.length > 0 ? (
                <p
                  className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-primary"
                  title={`작성자 ${book.author.name} · 공유: ${sharedWith.map((u) => u.name).join(", ")}`}
                >
                  <Share2 className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">
                    {sharedWithLabel(sharedWith)}에게 공유됨
                  </span>
                </p>
              ) : null}
            </div>
          </Link>
        </CardContent>

        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="북 삭제"
            title="북 삭제"
            className="absolute right-6 top-6 z-20 size-7 rounded-full border border-border bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover/card:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </Card>
    </li>
  );
}
