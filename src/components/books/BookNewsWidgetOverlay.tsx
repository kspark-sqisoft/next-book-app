import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Newspaper } from "lucide-react";
import { fetchNewsHeadlines, type NewsArticlePayload } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  bookWidgetBackdropChromeStyle,
  parseBookWeatherBackground,
  parseBookWidgetTextColor,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
  type BookCanvasElement,
  type BookNewsDisplayMode,
} from "@/lib/book-canvas";
import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import {
  computeNewsHeadlinesRefetchIntervalMs,
  newsHeadlinesGcTimeMs,
  newsHeadlinesStaleTimeMs,
  useTabVisibleForNewsPolling,
} from "@/lib/book-news-headlines-query-policy";

type Props = {
  el: Extract<BookCanvasElement, { type: "news" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

function resolveNewsMode(raw: BookNewsDisplayMode | undefined): BookNewsDisplayMode {
  return raw === "list" ? "list" : "carousel";
}

function resolveCarouselSec(el: Extract<BookCanvasElement, { type: "news" }>): number {
  const n = el.newsCarouselIntervalSec;
  if (typeof n === "number" && Number.isInteger(n) && n >= 3 && n <= 120) return n;
  return 5;
}

function resolvePageSize(el: Extract<BookCanvasElement, { type: "news" }>): number {
  const n = el.newsPageSize;
  if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 10) return n;
  return 5;
}

const TITLE_LINE_CLAMP_CLASS: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

function resolveNewsTitleLineClamp(
  el: Extract<BookCanvasElement, { type: "news" }>,
  displayMode: BookNewsDisplayMode,
): number {
  const n = el.newsTitleLineClamp;
  if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 6) return n;
  return displayMode === "carousel" ? 4 : 3;
}

function safeSectionTitle(raw: string | undefined): string {
  if (typeof raw !== "string") return "Headlines";
  const t = raw.replace(/[<>]/g, "").trim().slice(0, 36);
  return t.length > 0 ? t : "Headlines";
}

/** `listQueryKey`가 바뀌면 부모가 `key`로 리마운트해 인덱스를 0으로 맞춤(effect setState 린트 회피). */
function NewsCarouselViewport({
  articles,
  carouselSec,
  padPx,
  showNewsHeader,
  sectionTitle,
  metaFontPx,
  metaStyle,
  useDefaultLightText,
  titleLinkClass,
  titlePlainClass,
  titleClampClass,
  titleFontPx,
  titleStyle,
  linksEnabled,
  showNewsSource,
}: {
  articles: NewsArticlePayload[];
  carouselSec: number;
  padPx: number;
  showNewsHeader: boolean;
  sectionTitle: string;
  metaFontPx: number;
  metaStyle: CSSProperties | undefined;
  useDefaultLightText: boolean;
  titleLinkClass: string;
  titlePlainClass: string;
  titleClampClass: string;
  titleFontPx: number;
  titleStyle: CSSProperties | undefined;
  linksEnabled: boolean;
  showNewsSource: boolean;
}) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  useEffect(() => {
    if (articles.length <= 1) return;
    const t = window.setInterval(() => {
      setCarouselIndex((i) => (i + 1) % articles.length);
    }, carouselSec * 1000);
    return () => window.clearInterval(t);
  }, [articles.length, carouselSec]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden" style={{ padding: padPx }}>
      {showNewsHeader ? (
        <div className="mb-1 flex shrink-0 items-center justify-between gap-2 opacity-90">
          <div
            className={cn("flex items-center gap-1.5", useDefaultLightText && "text-white/90")}
            style={{ fontSize: metaFontPx, ...metaStyle }}
          >
            <Newspaper
              className="shrink-0"
              style={{ width: metaFontPx * 1.2, height: metaFontPx * 1.2 }}
              aria-hidden
            />
            <span className="font-semibold uppercase tracking-wider">{sectionTitle}</span>
          </div>
          {articles.length > 1 ? (
            <div
              className={cn("tabular-nums opacity-70", useDefaultLightText && "text-white/80")}
              style={{ fontSize: metaFontPx * 0.95, ...metaStyle }}
            >
              {carouselIndex + 1}/{articles.length}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        {articles.map((a, i) => {
          const active = i === carouselIndex;
          return (
            <div
              key={a.url}
              className={cn(
                "absolute inset-0 flex flex-col justify-center transition-all duration-500 ease-out",
                active ? "z-1 translate-y-0 opacity-100" : "z-0 translate-y-2 opacity-0",
              )}
              aria-hidden={!active}
            >
              {linksEnabled ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(titleLinkClass, titleClampClass, useDefaultLightText && "text-white")}
                  style={{ fontSize: titleFontPx, ...titleStyle }}
                >
                  {a.title}
                </a>
              ) : (
                <span
                  className={cn(titlePlainClass, titleClampClass, useDefaultLightText && "text-white")}
                  style={{ fontSize: titleFontPx, ...titleStyle }}
                >
                  {a.title}
                </span>
              )}
              {showNewsSource ? (
                <div
                  className={cn(
                    "mt-1.5 truncate",
                    useDefaultLightText && !metaStyle && "text-white/80",
                  )}
                  style={{ fontSize: metaFontPx, ...metaStyle }}
                >
                  {a.source}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BookNewsWidgetOverlay({ el, scale, mode, isSelected, liveFrame }: Props) {
  const queryClient = useQueryClient();
  const tabVisible = useTabVisibleForNewsPolling();
  const rawCc = (el.newsCountry ?? "").trim().toLowerCase().slice(0, 2);
  const country = /^[a-z]{2}$/.test(rawCc) ? rawCc : "kr";
  const category = el.newsCategory?.trim().toLowerCase() || undefined;
  const pageSize = resolvePageSize(el);
  const displayMode = resolveNewsMode(el.newsDisplayMode);
  const carouselSec = resolveCarouselSec(el);

  const listQueryKey = useMemo(
    () => ["news", "headlines", country, category ?? "", pageSize] as const,
    [country, category, pageSize],
  );
  const listQueryKeyJson = useMemo(() => JSON.stringify(listQueryKey), [listQueryKey]);

  const refetchIntervalMs = useMemo(
    () =>
      computeNewsHeadlinesRefetchIntervalMs({
        country,
        category: category ?? "",
        pageSize,
      }),
    [country, category, pageSize],
  );
  const staleTimeMs = useMemo(
    () => newsHeadlinesStaleTimeMs(refetchIntervalMs),
    [refetchIntervalMs],
  );
  const gcTimeMs = useMemo(() => newsHeadlinesGcTimeMs(refetchIntervalMs), [refetchIntervalMs]);

  const wasHiddenRef = useRef(false);
  useEffect(() => {
    if (tabVisible && wasHiddenRef.current) {
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
    }
    wasHiddenRef.current = !tabVisible;
  }, [tabVisible, listQueryKey, queryClient]);

  const { data, isPending, isError, error } = useQuery({
    queryKey: listQueryKey,
    queryFn: () =>
      fetchNewsHeadlines({
        country,
        category: category && category.length > 0 ? category : undefined,
        pageSize,
      }),
    staleTime: staleTimeMs,
    gcTime: gcTimeMs,
    retry: 1,
    refetchInterval: tabVisible ? refetchIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const articles: NewsArticlePayload[] = data?.articles ?? [];

  const w = el.width;
  const h = el.height;
  const o = resolveBookElementOpacity(el.opacity);
  const rot = resolveBookElementRotation(el.rotation);
  const pivot = bookElementPivotKonva({ x: el.x, y: el.y, width: w, height: h, rotation: el.rotation });
  const layoutOrigin = bookElementOverlayTopLeftFromPivot(pivot, w, h);
  const fx = liveFrame?.x ?? layoutOrigin.x;
  const fy = liveFrame?.y ?? layoutOrigin.y;
  const fw = liveFrame?.width ?? w;
  const fh = liveFrame?.height ?? h;
  const fRot = liveFrame != null ? liveFrame.rotation : rot;

  /**
   * Konva 변형 중 `fh`/`fw`는 프리뷰로 바뀌지만, 폰트·패딩을 그에 맞추면 아래만 늘릴 때
   * 헤더/상단 패딩이 커져 "위도 같이 커지는" 것처럼 보입니다. 드래그 중에는 저장된 크기로만 메트릭을 잡습니다.
   */
  const metricsH = liveFrame != null ? h : fh;
  const defaultTitleLogical = metricsH * 0.072;
  const defaultMetaLogical = metricsH * 0.055;
  const titleFontPx =
    typeof el.newsTitleFontSize === "number" && Number.isInteger(el.newsTitleFontSize)
      ? el.newsTitleFontSize * scale
      : Math.max(10 * scale, defaultTitleLogical * scale);
  const metaFontPx =
    typeof el.newsMetaFontSize === "number" && Number.isInteger(el.newsMetaFontSize)
      ? el.newsMetaFontSize * scale
      : Math.max(8 * scale, defaultMetaLogical * scale);
  const titleLineClamp = resolveNewsTitleLineClamp(el, displayMode);
  const titleClampClass =
    TITLE_LINE_CLAMP_CLASS[titleLineClamp] ?? TITLE_LINE_CLAMP_CLASS[3]!;
  const padCanvasPx =
    typeof el.newsContentPaddingPx === "number" && Number.isInteger(el.newsContentPaddingPx)
      ? Math.min(40, Math.max(4, el.newsContentPaddingPx))
      : Math.round(Math.max(10, Math.min(metricsH * 0.06, 28)));
  const padPx = padCanvasPx * scale;
  const sectionTitle = safeSectionTitle(el.newsSectionTitle);
  const showNewsHeader = el.newsShowHeader !== false;
  const showNewsSource = el.newsShowSource !== false;
  const linksEnabled = el.newsLinksEnabled !== false;

  const errMsg = error instanceof Error ? error.message : "불러오지 못했습니다.";

  const titleColor = parseBookWidgetTextColor(el.newsTextColor);
  const metaColor = parseBookWidgetTextColor(el.newsMetaColor);
  const titleStyle: CSSProperties | undefined = titleColor
    ? { color: titleColor }
    : undefined;
  const metaStyle: CSSProperties | undefined = metaColor
    ? { color: metaColor }
    : titleColor
      ? { color: titleColor, opacity: 0.82 }
      : undefined;
  const useDefaultLightText = !titleColor && !metaColor;

  const customBg = parseBookWeatherBackground(el.newsBackground);
  const backdropChrome = customBg ? bookWidgetBackdropChromeStyle(customBg) : null;
  const brPx = Math.max(0, resolveBookElementBorderRadius(el) * scale);
  const ow = resolveBookElementOutlineWidth(el);
  const oc = resolveBookElementOutlineColor(el);
  const outlineRing =
    mode === "edit" && ow > 0 ? `0 0 0 ${Math.max(0.5, ow * scale)}px ${oc}` : "";
  const bgShadow = !customBg
    ? "0 16px 40px -10px rgba(0,0,0,0.35), 0 6px 20px -8px rgba(0,0,0,0.22)"
    : customBg && backdropChrome && backdropChrome.boxShadow !== "none"
      ? backdropChrome.boxShadow
      : "";
  const mergedShadow = [bgShadow, outlineRing].filter(Boolean).join(", ");

  const titleBaseClass =
    "min-w-0 font-medium leading-snug transition-opacity";
  const titleLinkClass = cn(
    titleBaseClass,
    "pointer-events-auto underline underline-offset-2 hover:opacity-90",
  );
  const titlePlainClass = cn(titleBaseClass, "pointer-events-none cursor-default select-text");

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden",
        !customBg &&
          mode === "edit" &&
          "ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
        isSelected && mode === "edit" && "ring-2 ring-primary ring-offset-0",
      )}
      style={{
        left: fx * scale,
        top: fy * scale,
        width: fw * scale,
        height: fh * scale,
        opacity: o,
        transform: fRot !== 0 ? `rotate(${fRot}deg)` : undefined,
        transformOrigin: "center center",
        borderRadius: brPx,
        ...(customBg
          ? {
              background: customBg,
              backgroundImage: "none",
              border: backdropChrome?.border,
            }
          : {
              background: "linear-gradient(145deg, #1e293b 0%, #0f172a 48%, #172554 100%)",
            }),
        boxShadow: mergedShadow || undefined,
      }}
    >
      {isPending ? (
        <div
          className={cn(
            "flex h-full min-h-0 items-center justify-center gap-2 px-3",
            useDefaultLightText && "text-white/90",
          )}
          style={{ fontSize: metaFontPx, ...metaStyle }}
        >
          <Loader2
            className="shrink-0 animate-spin"
            style={{ width: metaFontPx * 1.35, height: metaFontPx * 1.35 }}
            aria-hidden
          />
          <span>뉴스 불러오는 중…</span>
        </div>
      ) : isError ? (
        <div
          className="flex h-full min-h-0 flex-col items-center justify-center gap-1.5 px-3 text-center text-amber-50"
          style={{ fontSize: metaFontPx }}
        >
          <Newspaper
            className="shrink-0 opacity-90"
            style={{ width: titleFontPx * 1.6, height: titleFontPx * 1.6 }}
            aria-hidden
          />
          <span className="max-w-[95%] text-[0.8em] font-medium leading-snug">{errMsg}</span>
        </div>
      ) : articles.length === 0 ? (
        <div
          className="flex h-full min-h-0 flex-col items-center justify-center gap-1.5 px-3 text-center text-white/75"
          style={{ fontSize: metaFontPx }}
        >
          <span>표시할 기사가 없습니다.</span>
          <span className="max-w-[95%] text-[0.72em] leading-snug opacity-90">
            개발 시 프론트(Vite)가 <code className="rounded bg-black/25 px-1">/news</code>를 백엔드로
            프록시하는지, 인스펙터 국가 코드(예: kr→us)·카테고리·백엔드{" "}
            <code className="rounded bg-black/25 px-1">NEWSAPI_KEY</code>를 확인해 보세요.
          </span>
        </div>
      ) : displayMode === "list" ? (
        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden",
            showNewsHeader && "gap-2",
          )}
          style={{ padding: padPx }}
        >
          {showNewsHeader ? (
            <div
              className={cn(
                "flex shrink-0 items-center gap-1.5 opacity-90",
                useDefaultLightText && "text-white/90",
              )}
              style={{ fontSize: metaFontPx, ...metaStyle }}
            >
              <Newspaper
                className="shrink-0 opacity-95"
                style={{ width: metaFontPx * 1.2, height: metaFontPx * 1.2 }}
                aria-hidden
              />
              <span className="font-semibold uppercase tracking-wider">{sectionTitle}</span>
            </div>
          ) : null}
          <ul className="min-h-0 flex-1 space-y-2 overflow-hidden">
            {articles.map((a) => (
              <li
                key={a.url}
                className={cn(
                  "min-w-0 border-b pb-2 last:border-0 last:pb-0",
                  useDefaultLightText ? "border-white/10" : "border-current/15",
                )}
              >
                {linksEnabled ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      titleLinkClass,
                      titleClampClass,
                      useDefaultLightText && "text-white",
                    )}
                    style={{ fontSize: titleFontPx, ...titleStyle }}
                  >
                    {a.title}
                  </a>
                ) : (
                  <span
                    className={cn(
                      titlePlainClass,
                      titleClampClass,
                      useDefaultLightText && "text-white",
                    )}
                    style={{ fontSize: titleFontPx, ...titleStyle }}
                  >
                    {a.title}
                  </span>
                )}
                {showNewsSource ? (
                  <div
                    className={cn(
                      "mt-0.5 truncate",
                      useDefaultLightText && !metaStyle && "text-white/80",
                    )}
                    style={{ fontSize: metaFontPx, ...metaStyle }}
                  >
                    {a.source}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <NewsCarouselViewport
          key={listQueryKeyJson}
          articles={articles}
          carouselSec={carouselSec}
          padPx={padPx}
          showNewsHeader={showNewsHeader}
          sectionTitle={sectionTitle}
          metaFontPx={metaFontPx}
          metaStyle={metaStyle}
          useDefaultLightText={useDefaultLightText}
          titleLinkClass={titleLinkClass}
          titlePlainClass={titlePlainClass}
          titleClampClass={titleClampClass}
          titleFontPx={titleFontPx}
          titleStyle={titleStyle}
          linksEnabled={linksEnabled}
          showNewsSource={showNewsSource}
        />
      )}
    </div>
  );
}
