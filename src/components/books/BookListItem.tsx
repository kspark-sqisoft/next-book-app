import { BookMarked } from "lucide-react";
import Link from "next/link";

import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import type { BookListItem as BookListItemType } from "@/lib/api";
import { formatDateMediumShort } from "@/lib/format-date";

type Props = {
  book: BookListItemType;
  /** `useBookPageThumbnails` 등으로 만든 첫 슬라이드 PNG data URL */
  coverThumbDataUrl: string | null | undefined;
};

export function BookListItem({ book, coverThumbDataUrl }: Props) {
  const hasPreview = book.coverPreview != null;
  const showImage = Boolean(coverThumbDataUrl);

  return (
    <li>
      <Card className="group/card relative !gap-0 overflow-hidden !p-0 !py-0 transition-colors hover:bg-muted/30">
        <div className="relative min-h-[7.5rem] w-full overflow-hidden rounded-xl">
          {showImage ? (
            <>
              <SafeImage
                src={coverThumbDataUrl}
                alt=""
                className="pointer-events-none absolute inset-0 z-0 size-full object-cover saturate-[0.95]"
                loading="lazy"
                placeholderLabel={`「${book.title}」 북 목록 배경`}
              />
              <div
                className="pointer-events-none absolute inset-0 z-1 bg-linear-to-r from-card/82 via-card/48 to-card/28 dark:from-card/85 dark:via-card/52 dark:to-card/32"
                aria-hidden
              />
            </>
          ) : hasPreview ? (
            <div
              className="pointer-events-none absolute inset-0 z-0 bg-muted/30 dark:bg-muted/25"
              style={
                book.coverPreview?.backgroundColor
                  ? {
                      backgroundImage: `linear-gradient(145deg, ${book.coverPreview.backgroundColor}66, transparent 72%)`,
                    }
                  : undefined
              }
              aria-hidden
            />
          ) : (
            <div
              className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-muted/35 text-muted-foreground/20 dark:bg-muted/25 dark:text-muted-foreground/15"
              aria-hidden
            >
              <BookMarked className="size-24" strokeWidth={1} />
            </div>
          )}

          <div className="relative z-10 min-h-[7.5rem] min-w-0">
            <Link
              href={`/books/${book.id}`}
              className="flex min-h-[7.5rem] min-w-0 flex-col justify-center gap-1.5 px-4 py-3 sm:py-3.5"
            >
              <h3 className="font-heading line-clamp-1 h-6 shrink-0 text-base font-semibold leading-6 text-foreground transition-colors group-hover/card:text-primary">
                {book.title}
              </h3>
              <p className="flex min-h-8 shrink-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                <AuthorAvatarInline author={book.author} size="xs">
                  {" "}
                  · 페이지 {book.pageCount} ·{" "}
                  {formatDateMediumShort(book.updatedAt)}
                </AuthorAvatarInline>
              </p>
            </Link>
          </div>
        </div>
      </Card>
    </li>
  );
}
