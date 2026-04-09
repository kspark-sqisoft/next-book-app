import type { ReactNode } from "react";

import { SafeImage } from "@/components/ui/safe-image";
import type { PostAuthor } from "@/lib/api";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md";

const sizeClass: Record<Size, string> = {
  /** 목록 카드 메타 줄 */
  xs: "size-7",
  /** 댓글·보조 메타 */
  sm: "size-9",
  /** 글 상단 작성자 등 강조 */
  md: "size-11",
};

/** 글·댓글 메타: 프로필 이미지가 있을 때만 이름 앞에 원형으로 표시 */
export function AuthorAvatarInline({
  author,
  size = "sm",
  className,
  children,
}: {
  author: PostAuthor;
  size?: Size;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-2",
        className,
      )}
    >
      {author.imageUrl ? (
        <SafeImage
          src={author.imageUrl}
          alt=""
          hideOnError
          placeholderLabel={`${author.name} 프로필 이미지`}
          className={cn(
            sizeClass[size],
            "shrink-0 rounded-full object-cover ring-1 ring-border",
          )}
        />
      ) : null}
      <span className="min-w-0 truncate">
        {author.name}
        {children}
      </span>
    </span>
  );
}
