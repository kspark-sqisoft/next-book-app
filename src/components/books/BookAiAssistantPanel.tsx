// 북 레이아웃 AI 채팅 UI: 서버 액션 스트리밍·Pexels 제안
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchBookAiChat, requestBookLayoutAi } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import {
  addPagesTotalCount,
  type BookLayoutAiAction,
  bookTitleActions,
  pageBackgroundActions,
  pageTitleActions,
  slideDimensionsFromActions,
  widgetPlacementsFromLayoutAiActions,
} from "@/lib/book-ai-placement";
import type { BookCanvasElement } from "@/lib/book-canvas";
import {
  floatingDockAiInsetStartClass,
  floatingDockBottomInsetClass,
  floatingDockFabButtonClass,
  floatingDockFabIconClass,
} from "@/lib/floating-dock-chrome";
import { cn } from "@/lib/utils";

type ChatLine = { role: "user" | "assistant"; text: string; lineKey: string };

const ASSISTANT_TIPS: { title: string; hints: string[] }[] = [
  {
    title: "위젯 배치",
    hints: [
      "서울 날씨 위젯을 좌상단에 넣어줘",
      "디지털 시계를 화면 정중앙에",
      "부산 날씨를 우상단에",
    ],
  },
  {
    title: "텍스트",
    hints: [
      "안녕하세요 란 텍스트를 넣어줘",
      "『환영합니다』 문구를 텍스트 위젯으로 넣어줘",
      "큰 글자로 부제목 하나 넣어줘",
    ],
  },
  {
    title: "이미지·짧은 동영상",
    hints: [
      "스위스 아름다운 풍경 이미지를 넣어줘",
      "바다 파도 짧은 동영상 클립 넣어줘",
      "풍경 사진 이미지 위젯 넣어줘",
      "동영상 위젯을 선택한 뒤 다른 바다 장면으로 바꿔줘",
    ],
  },
  {
    title: "슬라이드·페이지",
    hints: [
      "빈 슬라이드 하나 추가해줘",
      "페이지 두 장 더 만들어줘",
      "슬라이드 1번(첫 번째) 제목을 도입부로 바꿔줘",
    ],
  },
  {
    title: "북 제목·배경·해상도",
    hints: [
      "북 제목을 여행 일기로 바꿔줘",
      "슬라이드 배경을 짙은 남색으로 해줘",
      "캔버스 해상도를 풀HD(1920×1080)로 바꿔줘",
    ],
  },
  {
    title: "되돌리기·삭제",
    hints: ["방금 작업 되돌려줘", "다시 실행해줘", "이 페이지 지워줘"],
  },
  {
    title: "한 번에 여러 가지",
    hints: [
      "새 슬라이드 추가하고 거기에 날씨 넣어줘",
      "배경 연한 회색으로 하고 텍스트로 제목만 넣어줘",
    ],
  },
];

type BookAiAssistantPanelProps = {
  slideWidth: number;
  slideHeight: number;
  /** 전체 슬라이드(페이지) 수 — 서버가 번호 해석에 사용 */
  pageCount: number;
  /** 현재 보고 있는 슬라이드 인덱스(0-based) */
  activePageIndex: number;
  /** 한 번의 AI 응답으로 추가할 요소. targetSlideNumber(1-based)가 있으면 해당 슬라이드에 넣음 */
  onApplyElements: (
    elements: BookCanvasElement[],
    options?: { targetSlideNumber?: number },
  ) => void;
  onApplyPageBackground?: (backgroundColor: string) => void;
  /** 왼쪽 목록의 슬라이드 이름; slideNumber 생략 시 현재 보는 슬라이드(1-based) */
  onApplyPageTitle?: (
    title: string,
    options?: { slideNumber?: number },
  ) => void;
  /** 헤더의 북(문서) 제목 */
  onApplyBookTitle?: (title: string) => void;
  /** 빈 슬라이드를 맨 뒤에 count장 추가하고 마지막 슬라이드로 이동 */
  onAddPages?: (count: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  /** 현재 슬라이드 삭제 확인(기존 페이지 삭제 다이얼로그) */
  onRequestRemoveCurrentPage?: () => void;
  /** 헤더 «캔버스» W/H와 동일한 북 전체 슬라이드 해상도 */
  onApplySlideDimensions?: (partial: {
    slideWidth?: number;
    slideHeight?: number;
  }) => void;
  /** 이미지·비디오 하나만 선택된 경우에만 서버로 보냄 — «바꿔줘» 등이 replace로 이어짐 */
  layoutAiMediaSelection?: {
    elementId: string;
    kind: "image" | "video";
  } | null;
  onPatchBookElement?: (
    elementId: string,
    patch: Partial<BookCanvasElement>,
  ) => void;
  floatingStackZIndex?: number;
  onRaiseFloatingStack?: () => void;
  className?: string;
  /** 저장된 북이면 대화를 DB에 남기고, 패널을 다시 열 때 서버에서 불러옵니다. `/books/new` 는 생략. */
  bookId?: number | null;
};

export function BookAiAssistantPanel({
  slideWidth,
  slideHeight,
  pageCount,
  activePageIndex,
  onApplyElements,
  onApplyPageBackground,
  onApplyPageTitle,
  onApplyBookTitle,
  onAddPages,
  onUndo,
  onRedo,
  onRequestRemoveCurrentPage,
  onApplySlideDimensions,
  layoutAiMediaSelection,
  onPatchBookElement,
  floatingStackZIndex,
  onRaiseFloatingStack,
  className,
  bookId = null,
}: BookAiAssistantPanelProps) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [tipIndex, setTipIndex] = useState(0);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tipCount = ASSISTANT_TIPS.length;
  const currentTip = ASSISTANT_TIPS[tipIndex] ?? ASSISTANT_TIPS[0]!;

  const showPrevTip = useCallback(() => {
    setTipIndex((i) => (i - 1 + tipCount) % tipCount);
  }, [tipCount]);

  const showNextTip = useCallback(() => {
    setTipIndex((i) => (i + 1) % tipCount);
  }, [tipCount]);

  const applyHintToInput = useCallback((hint: string) => {
    setInput(hint);
  }, []);

  useEffect(() => {
    if (!open || bookId == null || bookId <= 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchBookAiChat(bookId);
        if (cancelled) return;
        setLines(
          rows.map((r) => ({
            role: r.role,
            text: r.text,
            lineKey: `srv-${r.id}`,
          })),
        );
      } catch {
        if (!cancelled) {
          toast.error("대화 기록을 불러오지 못했습니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, bookId]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || pending) return;
    setInput("");
    const userKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `u-${Date.now()}`;
    setLines((prev) => [
      ...prev,
      { role: "user", text: msg, lineKey: userKey },
    ]);
    setPending(true);
    try {
      const { reply, actions } = await requestBookLayoutAi({
        message: msg,
        slideWidth,
        slideHeight,
        pageCount: Math.max(1, pageCount),
        activeSlideIndex:
          pageCount <= 0
            ? 0
            : Math.min(
                Math.max(0, activePageIndex),
                Math.max(0, pageCount - 1),
              ),
        ...(layoutAiMediaSelection
          ? { selection: layoutAiMediaSelection }
          : {}),
        ...(bookId != null && bookId > 0 ? { bookId } : {}),
      });
      const safeActions = actions as BookLayoutAiAction[];

      let mediaReplaces = 0;
      if (layoutAiMediaSelection && onPatchBookElement) {
        for (const a of safeActions) {
          if (a.type !== "replace_widget_media") continue;
          if (a.elementId !== layoutAiMediaSelection.elementId) continue;
          if (a.widget !== layoutAiMediaSelection.kind) continue;
          const src = a.src?.trim();
          if (!src || !/^https:\/\//i.test(src)) continue;
          if (a.widget === "video") {
            const p = a.posterSrc?.trim();
            const posterSrc = p && /^https:\/\//i.test(p) ? p : null;
            onPatchBookElement(a.elementId, { src, posterSrc });
          } else {
            onPatchBookElement(a.elementId, { src });
          }
          mediaReplaces += 1;
        }
      }

      let undoSteps = 0;
      let redoSteps = 0;
      let removeRequests = 0;
      for (const a of safeActions) {
        if (a.type === "undo") {
          onUndo?.();
          undoSteps += 1;
        } else if (a.type === "redo") {
          onRedo?.();
          redoSteps += 1;
        } else if (a.type === "remove_current_page") {
          onRequestRemoveCurrentPage?.();
          removeRequests += 1;
        }
      }

      const batchActions = safeActions.filter(
        (x) =>
          x.type !== "undo" &&
          x.type !== "redo" &&
          x.type !== "remove_current_page" &&
          x.type !== "set_slide_dimensions",
      );

      const dim = slideDimensionsFromActions(safeActions);
      if (dim.slideWidth != null || dim.slideHeight != null) {
        onApplySlideDimensions?.(dim);
      }
      const placeW = dim.slideWidth ?? slideWidth;
      const placeH = dim.slideHeight ?? slideHeight;

      const placements = widgetPlacementsFromLayoutAiActions(
        batchActions,
        placeW,
        placeH,
      );

      const videoActs = batchActions.filter(
        (a): a is Extract<BookLayoutAiAction, { type: "add_widget" }> =>
          a.type === "add_widget" && a.widget === "video",
      );
      const videoPlacements = placements.filter(
        (p) => p.element.type === "video",
      );
      appLog("bookAi", "layout 응답 적용(개발 콘솔)", {
        videoActionsFromApi: videoActs.length,
        videoActionsWithHttpsSrc: videoActs.filter(
          (a) => typeof a.src === "string" && /^https:\/\//i.test(a.src.trim()),
        ).length,
        placementTotal: placements.length,
        videoPlacements: videoPlacements.length,
        videoTargets: videoPlacements.map((p) => ({
          slide1Based: p.targetSlideNumber ?? "(현재 선택 슬라이드)",
          srcLen: p.element.type === "video" ? p.element.src.length : 0,
        })),
        hint:
          videoActs.length > 0 && videoPlacements.length === 0
            ? "서버는 video 액션을 줬지만 src가 https가 아니면 위젯이 스킵됩니다."
            : videoPlacements.length > 0
              ? "캔버스에 비디오 노드 추가됨. 안 보이면 네트워크 탭에서 mp4/webm 요청 실패 여부 확인."
              : undefined,
      });

      const addCount = addPagesTotalCount(batchActions);
      const bgColors = pageBackgroundActions(batchActions);
      const slideTitles = pageTitleActions(batchActions);
      const bookTitles = bookTitleActions(batchActions);

      for (const t of bookTitles) {
        onApplyBookTitle?.(t);
      }

      const applyPageScoped = () => {
        for (const c of bgColors) {
          onApplyPageBackground?.(c);
        }
        for (const item of slideTitles) {
          onApplyPageTitle?.(
            item.title,
            item.slideNumber != null
              ? { slideNumber: item.slideNumber }
              : undefined,
          );
        }
        const groups = new Map<number | undefined, BookCanvasElement[]>();
        for (const pl of placements) {
          const key = pl.targetSlideNumber;
          const arr = groups.get(key) ?? [];
          arr.push(pl.element);
          groups.set(key, arr);
        }
        for (const [sn, els] of groups) {
          if (els.length === 0) continue;
          onApplyElements(
            els,
            sn != null ? { targetSlideNumber: sn } : undefined,
          );
        }
      };

      if (addCount > 0) {
        onAddPages?.(addCount);
      }
      /* add_page와 위젯을 같은 이벤트 루프 틱에서 처리하면 React 18이 setState를 순차 배치해,
       * 두 번째 updatePages의 draft에 새 슬라이드가 이미 포함됩니다. setTimeout(0)은 오히려
       * stale closure·타이밍 경쟁으로 슬라이드 3 등 고번 슬라이드에 안 붙는 원인이 됐습니다. */
      applyPageScoped();

      const dimApplied = dim.slideWidth != null || dim.slideHeight != null;

      if (
        undoSteps > 0 ||
        redoSteps > 0 ||
        removeRequests > 0 ||
        placements.length > 0 ||
        mediaReplaces > 0 ||
        bgColors.length > 0 ||
        slideTitles.length > 0 ||
        bookTitles.length > 0 ||
        addCount > 0 ||
        dimApplied
      ) {
        const parts: string[] = [];
        if (undoSteps > 0) {
          parts.push(
            undoSteps === 1 ? "한 단계 되돌림" : `되돌리기 ${undoSteps}회`,
          );
        }
        if (redoSteps > 0) {
          parts.push(
            redoSteps === 1 ? "다시 실행 1회" : `다시 실행 ${redoSteps}회`,
          );
        }
        if (removeRequests > 0) {
          parts.push(
            removeRequests === 1
              ? "슬라이드 삭제 확인 창"
              : `슬라이드 삭제 확인 ${removeRequests}회`,
          );
        }
        if (addCount > 0) {
          parts.push(
            addCount === 1
              ? "슬라이드 1장 추가"
              : `슬라이드 ${addCount}장 추가`,
          );
        }
        if (bgColors.length > 0) parts.push("배경 반영");
        if (bookTitles.length > 0) parts.push("북 제목 반영");
        if (slideTitles.length > 0) parts.push("슬라이드 이름 반영");
        if (placements.length > 0) {
          parts.push(
            placements.length === 1
              ? "위젯 1개 추가"
              : `위젯 ${placements.length}개 추가`,
          );
        }
        if (mediaReplaces > 0) {
          parts.push(
            mediaReplaces === 1
              ? "선택한 미디어 교체"
              : `선택 미디어 교체 ${mediaReplaces}건`,
          );
        }
        if (dimApplied) parts.push("캔버스 해상도 반영");
        toast.success(parts.join(" · "));
      }
      const asKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `a-${Date.now()}`;
      setLines((prev) => [
        ...prev,
        { role: "assistant", text: reply, lineKey: asKey },
      ]);
    } catch (e) {
      const m = e instanceof Error ? e.message : "요청에 실패했습니다.";
      toast.error(m);
      const errKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `e-${Date.now()}`;
      setLines((prev) => [
        ...prev,
        { role: "assistant", text: m, lineKey: errKey },
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, [
    input,
    onApplyElements,
    onApplyPageBackground,
    onApplyPageTitle,
    onApplyBookTitle,
    onAddPages,
    onUndo,
    onRedo,
    onRequestRemoveCurrentPage,
    onApplySlideDimensions,
    layoutAiMediaSelection,
    onPatchBookElement,
    pending,
    slideHeight,
    slideWidth,
    pageCount,
    activePageIndex,
    bookId,
  ]);

  const shell = (
    <div
      className={cn(
        "pointer-events-none fixed flex max-h-[calc(100svh-1rem)] flex-col justify-end gap-3 sm:max-h-[calc(100svh-2.5rem)]",
        floatingDockAiInsetStartClass,
        floatingDockBottomInsetClass,
        className,
      )}
      style={{
        zIndex: floatingStackZIndex ?? 280,
      }}
    >
      {open ? (
        <div
          className={cn(
            "pointer-events-auto flex h-[600px] max-h-[calc(100svh-2rem)] w-[min(calc(100vw-1rem),28rem)] shrink-0 flex-col overflow-hidden",
            "rounded-2xl border-2 border-violet-400/45 shadow-2xl shadow-violet-500/20 ring-2 ring-violet-300/35 backdrop-blur-xl",
            "dark:border-violet-500/45 dark:shadow-violet-950/55 dark:ring-violet-500/25",
            "bg-linear-to-br from-violet-50 via-white to-indigo-100/90",
            "dark:from-violet-950 dark:via-indigo-950 dark:to-violet-900",
          )}
          role="region"
          aria-label="AI 어시스턴트"
          onPointerDownCapture={() => onRaiseFloatingStack?.()}
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-violet-300/40 bg-white/55 px-4 py-3 dark:border-violet-600/35 dark:bg-black/25">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-600/30">
              <Sparkles className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-semibold leading-tight tracking-tight text-violet-950 dark:text-violet-50">
                AI 어시스턴트
              </h2>
              <p className="text-[12px] leading-snug text-violet-800/80 dark:text-violet-200/85">
                킬러 기능 — 말로 북을 편집합니다
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-9 shrink-0 text-violet-700 hover:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-white/10"
              aria-label="AI 어시스턴트 패널 닫기"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </header>
          <div
            className="shrink-0 border-b border-violet-200/50 bg-linear-to-b from-violet-500/8 to-transparent px-2 py-2.5 dark:border-violet-700/40 dark:from-violet-400/10"
            role="group"
            aria-label="할 수 있는 요청 예시 팁"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                showPrevTip();
              }
              if (e.key === "ArrowRight") {
                e.preventDefault();
                showNextTip();
              }
            }}
            tabIndex={0}
          >
            <div className="flex items-stretch gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-9 shrink-0 text-violet-700 hover:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-white/10"
                aria-label="이전 팁"
                onClick={showPrevTip}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <div className="min-w-0 flex-1 rounded-md px-1 py-0.5">
                <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-violet-600/90 dark:text-violet-400/90">
                  <Lightbulb className="size-3 shrink-0" aria-hidden />팁{" "}
                  {tipIndex + 1} / {tipCount}
                </div>
                <p className="mt-0.5 text-sm font-semibold leading-tight text-violet-950 dark:text-violet-50">
                  {currentTip.title}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {currentTip.hints.map((hint) => (
                    <li key={hint}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] leading-snug text-violet-900/85 transition-colors hover:bg-white/70 dark:text-violet-100/90 dark:hover:bg-white/10"
                        onClick={() => applyHintToInput(hint)}
                      >
                        {hint}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-9 shrink-0 text-violet-700 hover:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-white/10"
                aria-label="다음 팁"
                onClick={showNextTip}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
            <div
              className="mt-1.5 flex justify-center gap-1.5"
              role="tablist"
              aria-label="팁 선택"
            >
              {ASSISTANT_TIPS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === tipIndex}
                  aria-label={`${i + 1}번째 팁`}
                  className={cn(
                    "rounded-full transition-colors",
                    i === tipIndex
                      ? "size-2 bg-violet-600 shadow-sm shadow-violet-600/50 dark:bg-violet-400"
                      : "size-1.5 bg-violet-400/35 hover:bg-violet-500/50 dark:bg-violet-600/50 dark:hover:bg-violet-500/70",
                  )}
                  onClick={() => setTipIndex(i)}
                />
              ))}
            </div>
          </div>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-white/25 px-4 py-3 text-sm dark:bg-black/15"
          >
            {lines.length === 0 && !pending ? (
              <p className="px-1 py-3 text-center text-[13px] leading-relaxed text-violet-800/75 dark:text-violet-200/80">
                위 팁을 좌·우로 넘기며 예시를 확인하세요. 예시를 누르면 입력창에
                문장이 채워집니다.
              </p>
            ) : null}
            {lines.map((line) => (
              <div
                key={line.lineKey}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-[13px] leading-snug",
                  line.role === "user"
                    ? "ml-3 border border-violet-300/50 bg-linear-to-br from-violet-100 to-indigo-50 text-violet-950 dark:border-violet-600/40 dark:from-violet-900/80 dark:to-indigo-950/80 dark:text-violet-50"
                    : "mr-2 border border-violet-200/40 bg-white/70 text-violet-900/90 dark:border-violet-700/35 dark:bg-black/30 dark:text-violet-100/90",
                )}
              >
                {line.text}
              </div>
            ))}
            {pending ? (
              <div className="flex items-center gap-2 text-xs text-violet-700 dark:text-violet-300">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                해석 중…
              </div>
            ) : null}
          </div>
          <div className="shrink-0 space-y-2.5 border-t border-violet-300/45 bg-white/40 p-4 dark:border-violet-600/35 dark:bg-black/20">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="예: 날씨 위젯 넣어줘 · 북 제목을 ○○로"
              rows={3}
              disabled={pending}
              className="min-h-21 resize-none border-violet-200/70 bg-white/90 text-sm text-violet-950 placeholder:text-violet-400 dark:border-violet-600/50 dark:bg-black/40 dark:text-violet-50 dark:placeholder:text-violet-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              type="button"
              size="default"
              className="h-10 w-full gap-2 bg-linear-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-lg shadow-violet-600/25 hover:from-violet-500 hover:to-indigo-500 dark:shadow-violet-900/40"
              disabled={pending || !input.trim()}
              onClick={() => void send()}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              보내기
            </Button>
            <p className="text-[11px] leading-snug text-violet-800/65 dark:text-violet-200/70">
              보내기를 누르면{" "}
              <code className="rounded bg-violet-200/50 px-1 py-px text-[10px] dark:bg-violet-800/60">
                POST /books/ai/layout
              </code>{" "}
              한 번 나갑니다. 네트워크 탭에서{" "}
              <code className="rounded bg-violet-200/50 px-1 py-px text-[10px] dark:bg-violet-800/60">
                layout
              </code>{" "}
              또는 요청 헤더{" "}
              <code className="rounded bg-violet-200/50 px-1 py-px text-[10px] dark:bg-violet-800/60">
                X-Client-Feature: book-layout-ai
              </code>
              로 찾을 수 있어요. 슬라이드 반영만 하고{" "}
              <strong className="font-medium text-violet-950 dark:text-violet-100">
                북 저장은 따로
              </strong>{" "}
              해야 서버(DB)에 남습니다.
              {bookId != null && bookId > 0 ? (
                <>
                  {" "}
                  성공한 AI 대화도 이 북에 저장되어, 패널을 접었다 펼쳐도 이어서
                  볼 수 있어요(북 작성자만).
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}
      <Button
        type="button"
        size="icon"
        className={cn(
          floatingDockFabButtonClass,
          "pointer-events-auto ring-2 ring-inset ring-white/35",
          "bg-linear-to-br from-violet-600 to-indigo-600 text-white",
          "hover:from-violet-500 hover:to-indigo-500",
          !open &&
            "book-ai-fab-attention shadow-xl shadow-violet-600/35 dark:shadow-violet-950/60",
          open && "shadow-xl shadow-violet-600/35 dark:shadow-violet-950/60",
        )}
        aria-expanded={open}
        aria-label={
          open ? "AI 어시스턴트 패널 접기" : "AI 어시스턴트 패널 열기"
        }
        title="AI 어시스턴트"
        onClick={() => {
          onRaiseFloatingStack?.();
          setOpen((o) => !o);
        }}
      >
        <Bot
          className={floatingDockFabIconClass}
          strokeWidth={1.75}
          aria-hidden
        />
      </Button>
    </div>
  );

  return createPortal(shell, document.body);
}
