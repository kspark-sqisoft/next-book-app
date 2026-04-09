import { useEffect, useMemo, useState } from "react";
import { Film, Library } from "lucide-react";
import { publicAssetUrl } from "@/lib/api";
import {
  BOOK_MEDIA_LIBRARY_CHANGED,
  loadBookMediaLibrary,
  type BookMediaLibraryItem,
} from "@/lib/book-media-library";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
  acceptKind: "image" | "video" | "both";
  title?: string;
  onPick: (item: BookMediaLibraryItem) => void;
}) {
  const [libraryEpoch, setLibraryEpoch] = useState(0);

  const items = useMemo(() => {
    if (!open) return [];
    void libraryEpoch;
    const all = loadBookMediaLibrary(bookId);
    if (acceptKind === "both") return all;
    return all.filter((x) => x.kind === acceptKind);
  }, [open, bookId, acceptKind, libraryEpoch]);

  useEffect(() => {
    if (!open) return;
    const fn = (ev: Event) => {
      const d = (ev as CustomEvent<{ bookId?: number }>).detail;
      if (d?.bookId === bookId) setLibraryEpoch((k) => k + 1);
    };
    window.addEventListener(BOOK_MEDIA_LIBRARY_CHANGED, fn);
    return () => window.removeEventListener(BOOK_MEDIA_LIBRARY_CHANGED, fn);
  }, [open, bookId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(520px,85vh)] gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Library className="size-4 shrink-0 text-muted-foreground" aria-hidden />
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
                        <img src={thumb} alt="" className="size-full object-cover" />
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
