import { useState } from "react";
import {
  BOOK_TEMPLATE_STOCK_IMAGE_PATHS,
  getBookSlideTemplatePreviewLayers,
  type BookSlideTemplateId,
  type BookSlideTemplatePreviewLayer,
} from "@/lib/book-slide-templates";
import { cn } from "@/lib/utils";

function stockUrl(stockIndex: number): string {
  const p = BOOK_TEMPLATE_STOCK_IMAGE_PATHS;
  return p[stockIndex % p.length] ?? "/cards/img1.jpg";
}

function toneClass(tone: Extract<BookSlideTemplatePreviewLayer, { kind: "text" }>["tone"]) {
  switch (tone) {
    case "title":
      return "bg-slate-800/88 dark:bg-slate-200/85";
    case "body":
      return "bg-slate-300/85 dark:bg-slate-500/55";
    case "caption":
      return "bg-slate-400/70 dark:bg-slate-600/45";
    default:
      return "bg-muted";
  }
}

function PreviewImageLayer({
  layer,
  broken,
  onBroken,
}: {
  layer: Extract<BookSlideTemplatePreviewLayer, { kind: "image" }>;
  broken: boolean;
  onBroken: () => void;
}) {
  const src = stockUrl(layer.stockIndex);
  return (
    <div
      className={cn(
        "absolute overflow-hidden",
        broken && "bg-linear-to-br from-muted to-muted-foreground/15",
      )}
      style={{
        left: `${layer.leftPct}%`,
        top: `${layer.topPct}%`,
        width: `${layer.widthPct}%`,
        height: `${layer.heightPct}%`,
        borderRadius: layer.radiusPx ? `${layer.radiusPx}px` : undefined,
      }}
    >
      {!broken ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={onBroken}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-[6px] font-medium text-muted-foreground/80">IMG</span>
        </div>
      )}
    </div>
  );
}

export function BookSlideTemplatePreview({
  templateId,
  className,
}: {
  templateId: BookSlideTemplateId;
  className?: string;
}) {
  const layers = getBookSlideTemplatePreviewLayers(templateId);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-border/80 bg-white shadow-inner dark:bg-slate-950/40",
        className,
      )}
      style={{ aspectRatio: "16 / 9" }}
      aria-hidden
    >
      {layers.map((layer, i) => {
        if (layer.kind === "image") {
          return (
            <PreviewImageLayer
              key={`${templateId}-img-${i}`}
              layer={layer}
              broken={Boolean(brokenImages[i])}
              onBroken={() => setBrokenImages((prev) => ({ ...prev, [i]: true }))}
            />
          );
        }
        if (layer.kind === "accent") {
          return (
            <div
              key={`${templateId}-acc-${i}`}
              className={cn(
                "absolute rounded-[1px]",
                layer.variant === "alert" && "bg-red-600/88 dark:bg-red-700/78",
              )}
              style={{
                left: `${layer.leftPct}%`,
                top: `${layer.topPct}%`,
                width: `${layer.widthPct}%`,
                height: `${layer.heightPct}%`,
              }}
            />
          );
        }
        return (
          <div
            key={`${templateId}-txt-${i}`}
            className={cn("absolute rounded-[1px]", toneClass(layer.tone))}
            style={{
              left: `${layer.leftPct}%`,
              top: `${layer.topPct}%`,
              width: `${layer.widthPct}%`,
              height: `${layer.heightPct}%`,
            }}
          />
        );
      })}
    </div>
  );
}
