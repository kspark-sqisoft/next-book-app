import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PostMediaItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

type Props = {
  items: PostMediaItem[];
  className?: string;
};

export function PostMediaCarousel({ items, className }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: items.length > 1,
    dragFree: false,
    align: "center",
    /** 비디오 컨트롤·재생 클릭이 슬라이드 드래그로 먹히지 않도록 */
    watchDrag: (_api, evt) => {
      const t = evt.target;
      if (!(t instanceof Element)) return true;
      return !t.closest("[data-carousel-no-drag]");
    },
  });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    queueMicrotask(onSelect);
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-muted/20",
        className,
      )}
    >
      <div className="relative px-2 py-3 sm:px-3 sm:py-4">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="min-w-0 shrink-0 grow-0 basis-full pl-0.5 pr-0.5"
              >
                {item.kind === "image" ? (
                  <div className="relative mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-muted/40">
                    <SafeImage
                      src={item.url}
                      alt=""
                      className="absolute inset-0 m-auto h-full w-full object-contain"
                      loading={i === 0 ? "eager" : "lazy"}
                      placeholderLabel={`이미지 ${i + 1}/${items.length}`}
                    />
                  </div>
                ) : (
                  <div
                    data-carousel-no-drag
                    className="relative mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-black"
                    onPointerDownCapture={(e) => e.stopPropagation()}
                  >
                    <video
                      src={item.url}
                      controls
                      playsInline
                      preload={i === 0 ? "auto" : "metadata"}
                      poster={item.posterUrl ?? undefined}
                      className="absolute inset-0 h-full w-full object-contain"
                    >
                      동영상을 재생할 수 없습니다.
                    </video>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {items.length > 1 ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute inset-s-1 top-1/2 z-10 size-9 -translate-y-1/2 rounded-full border border-border/80 bg-background/90 shadow-md"
              aria-label="이전"
              onClick={() => emblaApi?.scrollPrev()}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute inset-e-1 top-1/2 z-10 size-9 -translate-y-1/2 rounded-full border border-border/80 bg-background/90 shadow-md"
              aria-label="다음"
              onClick={() => emblaApi?.scrollNext()}
            >
              <ChevronRight className="size-5" />
            </Button>
          </>
        ) : null}
      </div>

      {items.length > 1 ? (
        <div className="flex justify-center gap-1.5 border-t border-border py-2">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}번째 보기`}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === selected ? "bg-primary" : "bg-muted-foreground/30",
              )}
              onClick={() => emblaApi?.scrollTo(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
