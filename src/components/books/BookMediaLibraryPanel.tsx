// 업로드된 북 미디어 라이브러리(서버 보관): 그리드·재생·삭제·파일별 공유 + 공유받은 파일
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Film,
  GripVertical,
  ImagePlus,
  PictureInPicture2,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import {
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { BOOK_LIBRARY_DRAG_TYPE } from "@/components/books/BookSlideCanvas";
import { FloatingPanelResizeHandle } from "@/components/books/FloatingPanelResizeHandle";
import { MemberSharePopover } from "@/components/share/MemberShareDialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  addBookMediaLibraryItem,
  type BookMediaLibraryDto,
  type BookMediaLibraryItemDto,
  fetchBookMediaLibrary,
  getBookVideoRenderJob,
  publicAssetUrl,
  removeBookMediaLibraryItem,
  setBookMediaShare,
  setBookMediaShareAll,
  startBookVideoConcat,
  uploadBookMedia,
} from "@/lib/api";
import { isAdminUser } from "@/lib/authz";
import {
  clearBookMediaLibrary,
  loadBookMediaLibrary,
} from "@/lib/book-media-library";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
  bookDockedPanelRootClass,
} from "@/lib/book-workspace-ui";
import { bookKeys } from "@/lib/query-keys";
import {
  type FloatingPanelSize,
  normalizeFloatingPanelSize,
  useFloatingPanelResize,
} from "@/lib/use-floating-panel-resize";
import { cn } from "@/lib/utils";
import { captureVideoPosterJpeg } from "@/lib/video-poster";
import { useAuth } from "@/stores/auth-store";

const STORAGE_KEY = "book-media-library-panel";
const PANEL_MAX_W = 320;
const VIEW_MARGIN = 8;
const PANEL_COLLAPSED_ESTIMATE_W = 168;

type PanelStored = {
  left: number;
  top: number;
  collapsed: boolean;
  /** 사용자가 조절한 창 크기(없으면 기본 크기) */
  size?: FloatingPanelSize | null;
};

function loadStored(): PanelStored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PanelStored>;
    if (
      typeof p.left === "number" &&
      typeof p.top === "number" &&
      typeof p.collapsed === "boolean"
    ) {
      return {
        left: p.left,
        top: p.top,
        collapsed: p.collapsed,
        size: normalizeFloatingPanelSize(p.size),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 도크 패널 폭 추정 — 레일 오른쪽에 붙는 패널 */
const DOCK_ESTIMATE_W = 336;

function defaultCoords(): { left: number; top: number } {
  // 왼쪽 레일·도크 패널을 덮지 않게 캔버스 위쪽에 띄운다
  // (body 포털이라 겹치면 아래 UI 클릭을 막는다) — 좁은 화면은 왼쪽 여백으로.
  // 레일은 접힘/펼침에 따라 폭이 달라지므로 고정값 대신 실제 폭을 잰다.
  const rail = document.querySelector('nav[aria-label="편집 메뉴"]');
  const railW = rail?.getBoundingClientRect().width ?? 56;
  return {
    left:
      window.innerWidth < 800
        ? VIEW_MARGIN
        : Math.round(railW + DOCK_ESTIMATE_W) + VIEW_MARGIN,
    top: Math.max(VIEW_MARGIN, 96),
  };
}

function clampCoords(
  left: number,
  top: number,
  panelW: number,
  panelH: number,
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(panelW, vw - 2 * VIEW_MARGIN);
  const maxL = Math.max(VIEW_MARGIN, vw - w - VIEW_MARGIN);
  const maxT = Math.max(VIEW_MARGIN, vh - panelH - VIEW_MARGIN);
  return {
    left: Math.min(maxL, Math.max(VIEW_MARGIN, left)),
    top: Math.min(maxT, Math.max(VIEW_MARGIN, top)),
  };
}

function useBookMediaLibraryCore(bookId: number) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const libraryQuery = useQuery({
    queryKey: bookKeys.mediaLibrary(bookId),
    queryFn: () => fetchBookMediaLibrary(bookId),
  });
  const items = libraryQuery.data?.items ?? [];
  const sharedItems = libraryQuery.data?.sharedItems ?? [];

  const setLibrary = useCallback(
    (lib: BookMediaLibraryDto) => {
      queryClient.setQueryData(bookKeys.mediaLibrary(bookId), lib);
    },
    [bookId, queryClient],
  );
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: bookKeys.mediaLibrary(bookId),
    });
  }, [bookId, queryClient]);

  // 예전 브라우저(localStorage) 목록을 서버로 1회 이관
  const migratedBookRef = useRef<number | null>(null);
  useEffect(() => {
    if (migratedBookRef.current === bookId) return;
    migratedBookRef.current = bookId;
    const legacy = loadBookMediaLibrary(bookId);
    if (legacy.length === 0) return;
    void (async () => {
      // 오래된 항목부터 넣어 서버 목록도 최신순 유지
      for (const it of [...legacy].reverse()) {
        try {
          await addBookMediaLibraryItem(bookId, {
            kind: it.kind,
            src: it.src,
            posterSrc: it.posterSrc,
          });
        } catch {
          /* 형식이 맞지 않는 항목은 건너뜀 */
        }
      }
      clearBookMediaLibrary(bookId);
      refresh();
    })();
  }, [bookId, refresh]);

  const onDragStartItem = useCallback(
    (e: DragEvent, item: BookMediaLibraryItemDto) => {
      e.dataTransfer.setData(
        BOOK_LIBRARY_DRAG_TYPE,
        JSON.stringify({
          kind: item.kind,
          src: item.src,
          posterSrc: item.posterSrc,
        }),
      );
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  const onPickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      setUploading(true);
      try {
        // 동영상은 첫 프레임 poster(JPEG)를 만들어 함께 올린다 → 라이브러리 썸네일 표시.
        // 코덱/브라우저 제한으로 실패하면 null(썸네일 없이 업로드는 진행).
        const poster = f.type.startsWith("video/")
          ? await captureVideoPosterJpeg(f)
          : null;
        const res = await uploadBookMedia(bookId, f, poster);
        const lib = await addBookMediaLibraryItem(bookId, {
          kind: res.kind,
          src: res.url,
          posterSrc: res.posterUrl,
        });
        setLibrary(lib);
        toast.success(
          res.kind === "image"
            ? "라이브러리에 이미지를 추가했습니다."
            : "라이브러리에 동영상을 추가했습니다.",
        );
      } catch (err) {
        toast.error((err as Error).message || "업로드에 실패했습니다.");
      } finally {
        setUploading(false);
      }
    },
    [bookId, setLibrary],
  );

  return {
    items,
    sharedItems,
    fileRef,
    uploading,
    onPickFile,
    onDragStartItem,
    setLibrary,
    refresh,
  };
}

/**
 * 아이템 옆에 뜨는 미리보기 팝업 — 이미지 원본 표시, 비디오는 무음 무한 반복 재생.
 * 패널이 스크롤 컨테이너라 잘리지 않도록 body 포털 + fixed 배치. 기본은 타일
 * 오른쪽, 공간이 없으면 왼쪽으로 뒤집고 화면 안으로 클램프한다.
 */
function MediaPreviewPopup({
  item,
  anchor,
  onClose,
}: {
  item: BookMediaLibraryItemDto;
  anchor: DOMRect;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = 8;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.right + m;
    if (left + w > vw - m) left = anchor.left - w - m;
    if (left < m) left = Math.min(Math.max(m, anchor.left), vw - w - m);
    const top = Math.min(
      Math.max(m, anchor.top + anchor.height / 2 - h / 2),
      Math.max(m, vh - h - m),
    );
    setPos({ left, top });
  }, [anchor, item]);

  useEffect(() => {
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      // 토글 버튼은 자체 click 핸들러가 열고 닫음 — 여기서 닫으면 다시 열려버린다
      if (target.closest("[data-media-preview-toggle]")) return;
      onClose();
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    const onRelayout = () => onClose();
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onRelayout, true);
    window.addEventListener("resize", onRelayout);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onRelayout, true);
      window.removeEventListener("resize", onRelayout);
    };
  }, [onClose]);

  const src = publicAssetUrl(item.src) ?? item.src;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="미디어 미리보기"
      className="fixed z-[130] w-96 max-w-[90vw] overflow-hidden rounded-lg border border-border bg-card shadow-xl"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {item.kind === "image" ? (
        // 미리보기 전용 이미지 — 팝업 안에서 원본 비율 유지
        <img
          src={src}
          alt="미디어 미리보기"
          className="max-h-[55vh] w-full bg-black/50 object-contain"
          draggable={false}
        />
      ) : (
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          controls
          className="max-h-[60vh] w-full bg-black object-contain"
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="미리보기 닫기"
        className="absolute right-1 top-1 size-6 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:text-foreground"
        onClick={onClose}
      >
        <X className="size-3.5" />
      </Button>
    </div>,
    document.body,
  );
}

function MediaGrid({
  bookId,
  items,
  onDragStartItem,
  gridClassName,
  setLibrary,
  refresh,
}: {
  bookId: number;
  items: BookMediaLibraryItemDto[];
  onDragStartItem: (e: DragEvent, item: BookMediaLibraryItemDto) => void;
  gridClassName?: string;
  setLibrary: (lib: BookMediaLibraryDto) => void;
  refresh: () => void;
}) {
  const { user } = useAuth();
  const [pendingDelete, setPendingDelete] =
    useState<BookMediaLibraryItemDto | null>(null);
  /** 파일별 공유 팝오버 — 열려 있는 항목 id */
  const [shareItemId, setShareItemId] = useState<number | null>(null);
  /** 업로드한 사용자·관리자만 파일 공유/삭제 관리 */
  const canManageItem = useCallback(
    (item: BookMediaLibraryItemDto) =>
      Boolean(
        user &&
        (isAdminUser(user) || Number(user.sub) === Number(item.ownerId)),
      ),
    [user],
  );
  // 이어붙이기 — 선택 모드에서 비디오를 누른 순서대로 서버 ffmpeg으로 결합
  const [concatMode, setConcatMode] = useState(false);
  const [concatSel, setConcatSel] = useState<number[]>([]);
  const [concatProgress, setConcatProgress] = useState<number | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const videoCount = items.filter((it) => it.kind === "video").length;
  const concatRunning = concatProgress !== null;

  /** 미리보기 팝업 — 타일 옆에 떠서 이미지 표시·비디오 반복 재생 */
  const [preview, setPreview] = useState<{
    item: BookMediaLibraryItemDto;
    anchor: DOMRect;
  } | null>(null);

  const togglePreview = useCallback(
    (e: ReactMouseEvent, item: BookMediaLibraryItemDto) => {
      e.stopPropagation();
      const tile = (e.currentTarget as HTMLElement).closest("li");
      const rect = tile?.getBoundingClientRect();
      setPreview((prev) =>
        prev?.item.id === item.id ? null : rect ? { item, anchor: rect } : null,
      );
    },
    [],
  );

  // 미리보기 중인 항목이 목록에서 사라지면(삭제 등) 팝업도 닫는다
  useEffect(() => {
    setPreview((prev) =>
      prev && !items.some((it) => it.id === prev.item.id) ? null : prev,
    );
  }, [items]);

  const toggleConcatSelect = useCallback((id: number) => {
    setConcatSel((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const startConcat = useCallback(async () => {
    const urls = concatSel
      .map((id) => items.find((it) => it.id === id)?.src)
      .filter((u): u is string => Boolean(u));
    if (urls.length < 2) return;
    setConcatProgress(0);
    try {
      const { jobId } = await startBookVideoConcat(bookId, urls);
      const result = await new Promise<{
        kind: "image" | "video";
        url: string;
        posterUrl: string | null;
      }>((resolve, reject) => {
        const poll = async () => {
          try {
            const job = await getBookVideoRenderJob(jobId);
            if (job.status === "done" && job.result) {
              resolve(job.result);
              return;
            }
            if (job.status === "error") {
              reject(new Error(job.error || "이어붙이기에 실패했습니다."));
              return;
            }
            if (mountedRef.current) setConcatProgress(job.progress ?? 0);
            setTimeout(() => void poll(), 1000);
          } catch (e) {
            reject(e as Error);
          }
        };
        void poll();
      });
      const lib = await addBookMediaLibraryItem(bookId, {
        kind: result.kind,
        src: result.url,
        posterSrc: result.posterUrl,
      });
      setLibrary(lib);
      toast.success(
        `동영상 ${urls.length}개를 이어붙여 라이브러리에 추가했습니다.`,
      );
      if (mountedRef.current) {
        setConcatMode(false);
        setConcatSel([]);
      }
    } catch (e) {
      toast.error((e as Error).message || "이어붙이기에 실패했습니다.");
    } finally {
      if (mountedRef.current) setConcatProgress(null);
    }
  }, [bookId, concatSel, items, setLibrary]);

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        아직 없습니다. 업로드하면 여기에 쌓입니다.
      </p>
    );
  }
  return (
    <>
      {videoCount >= 2 || concatMode ? (
        <div className="mb-2 space-y-1.5">
          {concatRunning ? (
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
              <Spinner className="size-3.5 shrink-0" />
              동영상 이어붙이는 중… {Math.round((concatProgress ?? 0) * 100)}%
            </div>
          ) : concatMode ? (
            <>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                이어붙일 동영상을 순서대로 누르세요. 완성본은 라이브러리에
                추가됩니다.
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 flex-1 gap-1.5 px-2 text-xs"
                  disabled={concatSel.length < 2}
                  onClick={() => void startConcat()}
                >
                  <Film className="size-3.5" aria-hidden />
                  {concatSel.length}개 이어붙이기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setConcatMode(false);
                    setConcatSel([]);
                  }}
                >
                  취소
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-full gap-1.5 px-2 text-xs"
              onClick={() => setConcatMode(true)}
            >
              <Film className="size-3.5" aria-hidden />
              동영상 이어붙이기
            </Button>
          )}
        </div>
      ) : null}
      <ul className={cn("grid gap-2", gridClassName)}>
        {items.map((item) => {
          const thumb =
            item.kind === "image"
              ? publicAssetUrl(item.src)
              : publicAssetUrl(item.posterSrc);
          const selectable = concatMode && !concatRunning;
          const selectedOrder = concatSel.indexOf(item.id);
          const dimmed = concatMode && item.kind !== "video";
          return (
            <li key={item.id} className="relative">
              <div
                draggable={!concatMode}
                onDragStart={(e) => {
                  if (!concatMode) onDragStartItem(e, item);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (selectable && item.kind === "video")
                    toggleConcatSelect(item.id);
                }}
                className={cn(
                  "group relative aspect-square select-none overflow-hidden rounded-lg border border-border/80 bg-muted/40",
                  concatMode
                    ? item.kind === "video"
                      ? "cursor-pointer"
                      : "cursor-default"
                    : "cursor-grab active:cursor-grabbing hover:border-violet-400/50",
                  dimmed && "opacity-35",
                  selectedOrder >= 0 &&
                    "border-violet-500 ring-2 ring-violet-500/60",
                )}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="size-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Film className="size-8" aria-hidden />
                  </div>
                )}
                <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-background/85 px-1 text-[9px] font-medium text-foreground/90">
                  {item.kind === "image" ? "IMG" : "MOV"}
                </span>
                {selectedOrder >= 0 ? (
                  <span className="pointer-events-none absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow">
                    {selectedOrder + 1}
                  </span>
                ) : null}
              </div>
              {!concatMode && canManageItem(item) ? (
                <>
                  {/* 삭제 확인 팝오버 — 누른 항목 옆에서 바로 확인 */}
                  <Popover
                    open={pendingDelete?.id === item.id}
                    onOpenChange={(open) =>
                      setPendingDelete(open ? item : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute -right-1 -top-1 size-6 rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm hover:bg-destructive/15 hover:text-destructive"
                        aria-label="라이브러리에서 제거"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      sideOffset={6}
                      collisionPadding={8}
                      className="z-[260] w-64 gap-1.5 p-3"
                    >
                      <p className="text-sm font-semibold">
                        미디어를 삭제할까요?
                      </p>
                      <p className="text-xs leading-snug text-muted-foreground">
                        라이브러리 목록에서 제거됩니다. 서버에 업로드된 원본
                        파일과 이미 페이지에 넣은 항목은 그대로 유지됩니다.
                      </p>
                      <div className="mt-1 flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => setPendingDelete(null)}
                        >
                          취소
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 bg-destructive px-2.5 text-xs text-white hover:bg-destructive/90"
                          onClick={() => {
                            void removeBookMediaLibraryItem(item.id)
                              .then(() => refresh())
                              .catch((e: Error) =>
                                toast.error(
                                  e.message || "삭제에 실패했습니다.",
                                ),
                              );
                            setPendingDelete(null);
                          }}
                        >
                          삭제
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {/* 공유 팝오버 — 누른 미디어 항목 옆에 붙는다 */}
                  <MemberSharePopover
                    open={shareItemId === item.id}
                    onOpenChange={(open) =>
                      setShareItemId(open ? item.id : null)
                    }
                    title="미디어 파일 공유"
                    description="이 파일을 함께 쓸 회원을 고르세요. 공유받은 사용자는 자기 북의 「공유받은 파일」에서 쓸 수 있습니다."
                    ownerId={item.ownerId}
                    sharedUserIds={item.sharedUserIds}
                    sharedToAll={item.sharedToAll}
                    onToggle={async (userId, shared) => {
                      await setBookMediaShare(item.id, userId, shared);
                      refresh();
                    }}
                    onToggleShareAll={async (shared) => {
                      await setBookMediaShareAll(item.id, shared);
                      refresh();
                    }}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={cn(
                        "absolute -left-1 -top-1 size-6 rounded-full border border-border bg-background/95 shadow-sm hover:text-primary",
                        item.sharedToAll || item.sharedUserIds.length > 0
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                      aria-label="파일 공유"
                      title={
                        item.sharedToAll
                          ? "모든 사용자에게 공유 중"
                          : item.sharedUserIds.length > 0
                            ? `${item.sharedUserIds.length}명에게 공유 중`
                            : "파일 공유"
                      }
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Share2 className="size-3" />
                    </Button>
                  </MemberSharePopover>
                </>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-media-preview-toggle
                aria-label="미리보기"
                title="미리보기"
                className={cn(
                  "absolute bottom-0.5 right-0.5 size-6 rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-foreground",
                  preview?.item.id === item.id && "text-violet-500",
                )}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => togglePreview(e, item)}
              >
                <Eye className="size-3" />
              </Button>
            </li>
          );
        })}
      </ul>
      {preview ? (
        <MediaPreviewPopup
          item={preview.item}
          anchor={preview.anchor}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}

/** 다른 사용자가 나에게(또는 전체에) 공유한 파일 — 드래그·미리보기만 */
function SharedMediaGrid({
  items,
  onDragStartItem,
  gridClassName,
}: {
  items: BookMediaLibraryItemDto[];
  onDragStartItem: (e: DragEvent, item: BookMediaLibraryItemDto) => void;
  gridClassName?: string;
}) {
  const [preview, setPreview] = useState<{
    item: BookMediaLibraryItemDto;
    anchor: DOMRect;
  } | null>(null);

  const togglePreview = useCallback(
    (e: ReactMouseEvent, item: BookMediaLibraryItemDto) => {
      e.stopPropagation();
      const tile = (e.currentTarget as HTMLElement).closest("li");
      const rect = tile?.getBoundingClientRect();
      setPreview((prev) =>
        prev?.item.id === item.id ? null : rect ? { item, anchor: rect } : null,
      );
    },
    [],
  );

  if (items.length === 0) return null;
  return (
    <div className="mt-3 border-t border-border/60 pt-2">
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Share2 className="size-3 text-primary" aria-hidden />
        공유받은 파일
      </p>
      <ul className={cn("grid gap-2", gridClassName)}>
        {items.map((item) => {
          const thumb =
            item.kind === "image"
              ? publicAssetUrl(item.src)
              : publicAssetUrl(item.posterSrc);
          return (
            <li key={item.id} className="relative">
              <div
                draggable
                onDragStart={(e) => onDragStartItem(e, item)}
                onPointerDown={(e) => e.stopPropagation()}
                className="group relative aspect-square cursor-grab select-none overflow-hidden rounded-lg border border-border/80 bg-muted/40 hover:border-primary/50 active:cursor-grabbing"
                title={`${item.ownerName}님이 공유`}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="size-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Film className="size-8" aria-hidden />
                  </div>
                )}
                <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-background/85 px-1 text-[9px] font-medium text-foreground/90">
                  {item.kind === "image" ? "IMG" : "MOV"}
                </span>
                <span className="pointer-events-none absolute left-0.5 top-0.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-primary/85 px-1 text-[9px] font-medium text-primary-foreground">
                  {item.ownerName}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-media-preview-toggle
                aria-label="미리보기"
                title="미리보기"
                className={cn(
                  "absolute bottom-0.5 right-0.5 size-6 rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-foreground",
                  preview?.item.id === item.id && "text-violet-500",
                )}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => togglePreview(e, item)}
              >
                <Eye className="size-3" />
              </Button>
            </li>
          );
        })}
      </ul>
      {preview ? (
        <MediaPreviewPopup
          item={preview.item}
          anchor={preview.anchor}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

function BookMediaLibraryDocked({
  bookId,
  className,
  onRequestFloat,
}: {
  bookId: number;
  className?: string;
  onRequestFloat?: () => void;
}) {
  const {
    items,
    sharedItems,
    fileRef,
    uploading,
    onPickFile,
    onDragStartItem,
    setLibrary,
    refresh,
  } = useBookMediaLibraryCore(bookId);

  return (
    <div
      className={cn(bookDockedPanelRootClass(), className)}
      role="region"
      aria-label="미디어 라이브러리"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={onPickFile}
      />
      <div className={bookDockedPanelHeaderRowClass()}>
        <ImagePlus className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={cn(bookDockedPanelHeadingClass(), "min-w-0 flex-1")}>
          미디어 라이브러리
        </span>
        {onRequestFloat ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onRequestFloat}
          >
            <PictureInPicture2 className="size-3.5" aria-hidden />떠 있는 창
          </Button>
        ) : null}
      </div>
      <p className="shrink-0 border-b border-border/40 bg-muted/[0.04] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        업로드한 뒤 썸네일을 슬라이드로 끌어 놓을 수 있어요.
      </p>
      <div className="shrink-0 px-3 pb-2 pt-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full gap-2"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Spinner className="size-4" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          업로드
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-3 [-webkit-overflow-scrolling:touch]">
        <MediaGrid
          bookId={bookId}
          items={items}
          onDragStartItem={onDragStartItem}
          gridClassName="grid-cols-2 sm:grid-cols-3"
          setLibrary={setLibrary}
          refresh={refresh}
        />
        <SharedMediaGrid
          items={sharedItems}
          onDragStartItem={onDragStartItem}
          gridClassName="grid-cols-2 sm:grid-cols-3"
        />
      </div>
    </div>
  );
}

function BookMediaLibraryFloating({
  bookId,
  className,
  onCollapsedChange,
  onClose,
  stackZIndex,
  onRaiseStack,
}: {
  bookId: number;
  className?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  onClose?: () => void;
  stackZIndex?: number;
  onRaiseStack?: () => void;
}) {
  const {
    items,
    sharedItems,
    fileRef,
    uploading,
    onPickFile,
    onDragStartItem,
    setLibrary,
    refresh,
  } = useBookMediaLibraryCore(bookId);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);

  const [collapsed, setCollapsed] = useState(
    () => loadStored()?.collapsed ?? false,
  );
  /** 사용자가 키운 창 크기 — null이면 기본(최소) 크기 */
  const [size, setSize] = useState<FloatingPanelSize | null>(
    () => loadStored()?.size ?? null,
  );
  const onCollapsedChangeRef = useRef(onCollapsedChange);
  useEffect(() => {
    onCollapsedChangeRef.current = onCollapsedChange;
  });
  const [coords, setCoords] = useState<{ left: number; top: number }>(() => {
    if (typeof window === "undefined") return { left: 16, top: 96 };
    const s = loadStored();
    if (s) {
      const w = Math.min(window.innerWidth - 2 * VIEW_MARGIN, PANEL_MAX_W);
      return clampCoords(s.left, s.top, w, s.collapsed ? 48 : 280);
    }
    return defaultCoords();
  });
  const { onResizePointerDown, onResizePointerMove, onResizePointerUp } =
    useFloatingPanelResize({
      rootRef,
      baseWidth: PANEL_MAX_W,
      size,
      onSizeChange: setSize,
      viewMargin: VIEW_MARGIN,
    });

  const estimateHeight = collapsed ? 48 : 320;
  const estimateWidth = collapsed
    ? PANEL_COLLAPSED_ESTIMATE_W
    : Math.min(
        typeof window !== "undefined"
          ? window.innerWidth - 2 * VIEW_MARGIN
          : PANEL_MAX_W,
        PANEL_MAX_W,
      );

  const persist = useCallback((next: PanelStored) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    persist({ ...coords, collapsed, size });
  }, [coords, collapsed, size, persist]);

  useEffect(() => {
    onCollapsedChangeRef.current?.(collapsed);
  }, [collapsed]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setCoords((c) =>
      clampCoords(c.left, c.top, el.offsetWidth, el.offsetHeight),
    );
  }, [collapsed]);

  useEffect(() => {
    const onResize = () => {
      setCoords((c) => {
        const el = rootRef.current;
        const w = el?.offsetWidth ?? estimateWidth;
        const h = el?.offsetHeight ?? estimateHeight;
        return clampCoords(c.left, c.top, w, h);
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [collapsed, estimateHeight, estimateWidth]);

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onHeaderPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (
      (e.target as HTMLElement).closest(
        "[data-library-toggle],[data-library-upload],[data-library-close]",
      )
    ) {
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: coords.left,
      originTop: coords.top,
    };
  };

  const onHeaderPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const el = rootRef.current;
    const w =
      el?.offsetWidth ??
      Math.min(window.innerWidth - 2 * VIEW_MARGIN, PANEL_MAX_W);
    const h = el?.offsetHeight ?? estimateHeight;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setCoords(clampCoords(d.originLeft + dx, d.originTop + dy, w, h));
  };

  const onHeaderPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    endDrag();
  };

  // 편집기 컬럼(z-10) 안이면 왼쪽 레일(z-20)이 항상 위로 와 창이 가려진다 — body 포털로
  return createPortal(
    <div
      ref={rootRef}
      style={{
        left: coords.left,
        top: coords.top,
        ...(stackZIndex != null ? { zIndex: stackZIndex } : {}),
        // 사용자가 키운 크기(접힌 상태에선 무시) — 없으면 기본(최소) 크기
        ...(!collapsed && size != null
          ? { width: size.w, height: size.h }
          : {}),
      }}
      onPointerDownCapture={(e) => {
        if (e.button !== 0) return;
        onRaiseStack?.();
      }}
      className={cn(
        "pointer-events-auto fixed flex flex-col rounded-xl border shadow-lg backdrop-blur-md",
        stackZIndex == null && "z-[219]",
        collapsed
          ? "w-max max-w-[calc(100vw-2rem)] gap-0 border-violet-200/90 bg-violet-50/98 px-2 py-1.5 ring-1 ring-violet-200/45 dark:border-violet-500/35 dark:bg-violet-950/50 dark:ring-violet-400/25"
          : "w-[min(100vw-2rem,20rem)] max-w-[calc(100vw-2rem)] gap-2 border-border bg-card/95 p-2.5 ring-1 ring-border/40",
        className,
      )}
      role="region"
      aria-label="미디어 라이브러리"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={onPickFile}
      />
      <header
        className={cn(
          "touch-none flex cursor-grab select-none gap-2 border-b border-border/60 pb-2",
          collapsed ? "items-center border-0 pb-0" : "items-start",
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-200">
          <ImagePlus className="size-4" aria-hidden />
        </div>
        <div className={cn("min-w-0 flex-1 pt-0.5", collapsed && "shrink-0")}>
          <div className="flex items-center gap-1">
            {!collapsed ? (
              <GripVertical
                className="size-3.5 shrink-0 text-muted-foreground/80"
                aria-hidden
              />
            ) : null}
            <h2 className="font-heading text-sm font-semibold leading-none tracking-tight text-foreground">
              미디어
            </h2>
          </div>
          {!collapsed ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              업로드 후 썸네일을 슬라이드로 끌어 놓으세요
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            data-library-toggle
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? "미디어 라이브러리 펼치기" : "미디어 라이브러리 접기"
            }
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </Button>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              data-library-close
              aria-label="미디어 창 닫기"
              title="닫기"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onClose()}
            >
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </header>
      {!collapsed ? (
        <>
          <div className="flex justify-center px-0.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full gap-2"
              disabled={uploading}
              data-library-upload
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Spinner className="size-4" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              업로드
            </Button>
          </div>
          <div
            className={cn(
              "overflow-y-auto overflow-x-hidden px-0.5",
              // 크기 지정 시엔 남은 공간을 채우고, 기본 크기에선 3줄 정도까지만
              size != null ? "min-h-0 flex-1 pb-3" : "max-h-[220px]",
            )}
          >
            <MediaGrid
              bookId={bookId}
              items={items}
              onDragStartItem={onDragStartItem}
              gridClassName="grid-cols-3"
              setLibrary={setLibrary}
              refresh={refresh}
            />
            <SharedMediaGrid
              items={sharedItems}
              onDragStartItem={onDragStartItem}
              gridClassName="grid-cols-3"
            />
          </div>
          <FloatingPanelResizeHandle
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
          />
        </>
      ) : null}
    </div>,
    document.body,
  );
}

/**
 * 북별 업로드 미디어 목록. 슬라이드로 드래그해 같은 URL을 여러 번 배치할 수 있습니다.
 * - `docked`: 왼쪽 열(페이지 속성과 같은 헤더 스타일)
 * - `floating`: 화면 위 떠 있는 패널
 */
export function BookMediaLibraryPanel({
  bookId,
  variant = "floating",
  className,
  onCollapsedChange,
  onClose,
  onRequestFloat,
  floatingStackZIndex,
  onRaiseFloatingStack,
}: {
  bookId: number;
  variant?: "floating" | "docked";
  className?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  onClose?: () => void;
  onRequestFloat?: () => void;
  floatingStackZIndex?: number;
  onRaiseFloatingStack?: () => void;
}) {
  if (variant === "docked") {
    return (
      <BookMediaLibraryDocked
        bookId={bookId}
        className={className}
        onRequestFloat={onRequestFloat}
      />
    );
  }
  return (
    <BookMediaLibraryFloating
      bookId={bookId}
      className={className}
      onCollapsedChange={onCollapsedChange}
      onClose={onClose}
      stackZIndex={floatingStackZIndex}
      onRaiseStack={onRaiseFloatingStack}
    />
  );
}
