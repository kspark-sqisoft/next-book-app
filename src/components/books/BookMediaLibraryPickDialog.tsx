import { useQuery } from "@tanstack/react-query";
import { Film, Library } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchBookMediaLibrary, publicAssetUrl } from "@/lib/api";
import { bookKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

/** 선택 결과 — 위젯 교체·재생목록 추가에 필요한 필드만 */
export type BookMediaPick = {
  kind: "image" | "video";
  src: string;
  posterSrc: string | null;
};

export function BookMediaLibraryPickDialog({
  open,
  onOpenChange,
  bookId,
  acceptKind,
  title = "미디어 라이브러리에서 선택",
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: number;
  acceptKind: "image" | "video" | "both" | null;
  title?: string;
  onPick: (item: BookMediaPick) => void;
}) {
  const libraryQuery = useQuery({
    queryKey: bookKeys.mediaLibrary(bookId),
    queryFn: () => fetchBookMediaLibrary(bookId),
    enabled: open,
  });

  const items = useMemo(() => {
    if (!open || !libraryQuery.data) return [];
    // 내 북 라이브러리 + 공유받은 파일을 함께 보여준다
    const all = [...libraryQuery.data.items, ...libraryQuery.data.sharedItems];
    if (acceptKind === "both" || acceptKind == null) return all;
    return all.filter((x) => x.kind === acceptKind);
  }, [open, libraryQuery.data, acceptKind]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(520px,85vh)] gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Library
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {acceptKind === "image"
              ? "이 북에 올려 둔 이미지 중 하나로 위젯의 사진을 바꿉니다."
              : acceptKind === "video"
                ? "이 북에 올려 둔 동영상 중 하나로 위젯을 바꿉니다."
                : "이 북에 올려 둔 이미지·동영상 중에서 선택합니다."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(360px,55vh)] overflow-y-auto overscroll-contain px-3 py-3">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {acceptKind === "image"
                ? "라이브러리에 이미지가 없습니다. 미디어 탭에서 업로드하세요."
                : acceptKind === "video"
                  ? "라이브러리에 동영상이 없습니다. 미디어 탭에서 업로드하세요."
                  : "라이브러리에 미디어가 없습니다. 미디어 탭에서 업로드하세요."}
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((item) => {
                const thumb =
                  item.kind === "image"
                    ? publicAssetUrl(item.src)
                    : publicAssetUrl(item.posterSrc);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(item);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "group relative aspect-square w-full overflow-hidden rounded-lg border border-border/80 bg-muted/40",
                        "transition-colors hover:border-primary/50 hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <Film className="size-8" aria-hidden />
                        </div>
                      )}
                      <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-background/90 px-1 text-[9px] font-medium">
                        {item.kind === "image" ? "IMG" : "MOV"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="border-t border-border px-4 py-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
