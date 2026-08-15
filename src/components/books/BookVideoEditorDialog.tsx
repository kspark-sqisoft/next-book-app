"use client";

// 비디오 편집 — Twick 스튜디오(멀티트랙 타임라인)를 전체 화면으로 띄우고,
// 내보내기(Export)는 서버측 헤드리스 Chromium 렌더에 위임한다(브라우저를 붙잡지 않음).
// 진행률은 잡 폴링으로 받아오고, 완료 시 결과 URL을 호출측(미디어 라이브러리 등록)에 넘긴다.
import "@twick/studio/dist/studio.css";

import { LivePlayerProvider } from "@twick/live-player";
import { TwickStudio } from "@twick/studio";
import { INITIAL_TIMELINE_DATA, TimelineProvider } from "@twick/timeline";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  API_BASE_URL,
  getAccessToken,
  getBookVideoRenderJob,
  startBookVideoRender,
} from "@/lib/api";

declare global {
  interface Window {
    /**
     * @twick/studio 패치(patches/@twick+studio+…)가 orientation 변경 시 호출.
     * 기본 window.confirm 대신 아래 shadcn 확인 다이얼로그로 연결한다.
     */
    __twickConfirm?: (message: string) => Promise<boolean>;
  }
}

/** 서버 렌더 완료 결과 — 업로드는 서버가 이미 완료했고, 미디어 라이브러리 등록은 호출측 책임 */
export type RenderedMedia = {
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
};

type Props = {
  onClose: () => void;
  /** 서버 렌더에 필요 — 소유권 확인·저장 경로 결정 */
  bookId: number;
  /** 렌더·저장 완료 시 결과 URL 전달(미디어 라이브러리 등록용) */
  onRendered: (media: RenderedMedia) => void;
};

/** 대기 중인 orientation 확인 요청 — resolve로 사용자의 선택(계속/취소)을 라이브러리에 돌려준다 */
type OrientationConfirm = {
  resolve: (confirmed: boolean) => void;
};

export function BookVideoEditorDialog({ onClose, bookId, onRendered }: Props) {
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [orientationConfirm, setOrientationConfirm] =
    useState<OrientationConfirm | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // 편집기가 떠 있는 동안에만 브리지를 등록 — 라이브러리의 window.confirm 호출을
  // Promise 기반 shadcn 다이얼로그로 바꿔치기한다. 언마운트 시 대기 중 요청은 취소로 정리.
  useEffect(() => {
    window.__twickConfirm = () =>
      new Promise<boolean>((resolve) => {
        setOrientationConfirm({ resolve });
      });
    return () => {
      delete window.__twickConfirm;
      setOrientationConfirm((prev) => {
        prev?.resolve(false);
        return null;
      });
    };
  }, []);

  const resolveOrientation = useCallback((confirmed: boolean) => {
    setOrientationConfirm((prev) => {
      prev?.resolve(confirmed);
      return null;
    });
  }, []);

  // "My assets" 로컬 업로드용 인증: Twick 업로드 fetch는 Bearer 헤더를 못 붙이므로,
  // access token을 짧은 쿠키(twick_upload_at, /api/books 경로 한정)로 실어 업로드 엔드포인트가 검증하게 한다.
  // 프록시 리프레시로 토큰이 갱신될 수 있어 주기적으로 최신값으로 갱신하고, 언마운트 시 제거한다.
  useEffect(() => {
    const syncCookie = () => {
      const token = getAccessToken();
      if (token) {
        document.cookie = `twick_upload_at=${token}; path=/api/books; SameSite=Lax`;
      }
    };
    syncCookie();
    const iv = window.setInterval(syncCookie, 30_000);
    return () => {
      window.clearInterval(iv);
      document.cookie =
        "twick_upload_at=; path=/api/books; Max-Age=0; SameSite=Lax";
    };
  }, []);

  // 중앙 뷰 휠 줌 — 캔버스 위에서 휠로 컴포지션을 확대/축소(--twick-view-zoom 변수 갱신).
  // 타임라인/사이드 패널 위에서는 동작하지 않는다. 100% 근처는 스냅해 원위치가 쉽다.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let zoom = 1;
    const apply = () =>
      root.style.setProperty("--twick-view-zoom", String(zoom));
    const overCanvasView = (t: EventTarget | null): boolean => {
      const el = t as Element | null;
      if (!el?.closest) return false;
      if (
        el.closest(
          ".twick-editor-timeline-section, .panel-container, .media-content, .player-controls",
        )
      )
        return false;
      return !!el.closest(
        ".twick-editor-view-section, .twick-editor-main-container, .twick-editor-canvas-container",
      );
    };
    const onWheel = (e: WheelEvent) => {
      if (!overCanvasView(e.target)) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      let next = Math.min(4, Math.max(0.25, zoom * factor));
      if (Math.abs(next - 1) < 0.05) next = 1; // 100% 스냅
      zoom = next;
      apply();
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      root.removeEventListener("wheel", onWheel);
      root.style.removeProperty("--twick-view-zoom");
    };
  }, []);

  // 컴포지션 경계 프레임 — 편집 영역(렌더 해상도)이 뷰 배경과 같은 어두운 색이라 경계가 안 보인다.
  // 실제 캔버스의 화면 사각형(getBoundingClientRect: 줌 transform·리사이즈·해상도 변경 모두 반영)을
  // 매 프레임 측정해 오버레이 테두리를 정확히 겹쳐 그린다. 변화가 있을 때만 DOM을 갱신한다.
  useEffect(() => {
    const root = rootRef.current;
    const frame = frameRef.current;
    if (!root || !frame) return;
    let raf = 0;
    let last = "";
    const hide = () => {
      if (frame.style.opacity !== "0") frame.style.opacity = "0";
      last = "";
    };
    const tick = () => {
      const canvas = root.querySelector<HTMLCanvasElement>(
        ".twick-editor-canvas-container canvas",
      );
      const r = canvas?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) {
        const key = `${r.left}|${r.top}|${r.width}|${r.height}`;
        if (key !== last) {
          last = key;
          frame.style.left = `${r.left}px`;
          frame.style.top = `${r.top}px`;
          frame.style.width = `${r.width}px`;
          frame.style.height = `${r.height}px`;
          frame.style.opacity = "1";
        }
      } else {
        hide();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleExportVideo = useCallback(
    async (
      project: { tracks: unknown[]; backgroundColor?: string },
      videoSettings: {
        outFile: string;
        fps: number;
        resolution: { width: number; height: number };
      },
    ): Promise<{ status: boolean; message: string }> => {
      setExportProgress(0);
      try {
        const { width, height } = videoSettings.resolution;
        const fps = videoSettings.fps;
        // 렌더는 사용자 브라우저가 아니라 서버(헤드리스 Chromium)에서 수행 → 잡 시작 후 진행률 폴링.
        const { jobId } = await startBookVideoRender(
          bookId,
          {
            properties: { width, height, fps },
            tracks: project.tracks,
            backgroundColor: project.backgroundColor,
          },
          { width, height, fps, includeAudio: true },
        );

        const result = await new Promise<RenderedMedia>((resolve, reject) => {
          const poll = async () => {
            try {
              const job = await getBookVideoRenderJob(jobId);
              setExportProgress(job.progress);
              if (job.status === "done" && job.result) {
                resolve(job.result);
                return;
              }
              if (job.status === "error") {
                reject(new Error(job.error ?? "서버 렌더 실패"));
                return;
              }
              setTimeout(poll, 1000);
            } catch (err) {
              reject(err);
            }
          };
          void poll();
        });

        onRendered(result);
        toast.success("편집한 영상을 미디어 라이브러리에 저장했습니다.");
        return { status: true, message: "미디어 라이브러리에 저장했습니다." };
      } catch (e) {
        // 실패를 조용히 삼키지 않는다 — Twick은 반환값을 무시하므로 직접 노출.
        const message = e instanceof Error ? e.message : String(e);
        console.error("[비디오 편집] 서버 렌더 실패:", e);
        toast.error(`영상 내보내기 실패: ${message}`);
        return { status: false, message };
      } finally {
        setExportProgress(null);
      }
    },
    [bookId, onRendered],
  );

  /* 워크스페이스 패널·채팅(z≤3500)보다 위에 오도록 body 포털로 렌더 —
     내부에 두면 조상 스태킹 컨텍스트에 갇혀 기존 패널이 편집기를 가린다 */
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[5000] flex flex-col bg-background"
    >
      {/* My assets 라이브러리 타일을 가로 16:9로, 영상/이미지는 타일을 꽉 채워(cover) 썸네일이 보이게 오버라이드 */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .media-item { aspect-ratio: 16 / 9 !important; height: auto !important; }
            .media-item-content { width: 100% !important; height: 100% !important; object-fit: cover !important; background: #000; }
            /* 중앙 뷰 줌 — Twick은 캔버스 뷰 줌을 제공하지 않아 컴포지션을 CSS transform으로 확대/축소.
               CSS 변수로 적용해 Twick 리렌더가 인라인 스타일을 덮어써도 유지된다(휠 핸들러가 변수만 갱신). */
            .twick-editor-canvas-container {
              transform: scale(var(--twick-view-zoom, 1)) !important;
              transform-origin: center center !important;
            }
          `,
        }}
      />
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-3">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold">비디오 편집</h2>
          <p className="truncate text-[11px] text-muted-foreground">
            내보내기(Export) 시 서버에서 렌더링 후 미디어 라이브러리에
            저장됩니다 · 아래 트랙일수록 화면 앞에 표시됩니다
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 px-2.5 text-xs"
          disabled={exportProgress != null}
          onClick={() => setExitConfirmOpen(true)}
        >
          <X className="mr-1.5 size-3.5" aria-hidden />
          나가기
        </Button>
      </header>

      <AlertDialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>비디오 편집을 나갈까요?</AlertDialogTitle>
            <AlertDialogDescription>
              내보내기(Export)하지 않은 편집 내용은 저장되지 않고 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">계속 편집</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setExitConfirmOpen(false);
                onClose();
              }}
            >
              나가기
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={orientationConfirm != null}
        onOpenChange={(open) => {
          // 오버레이·ESC·취소로 닫히면 라이브러리에는 취소로 응답
          if (!open) resolveOrientation(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>화면 방향을 바꿀까요?</AlertDialogTitle>
            <AlertDialogDescription>
              방향(가로 ↔ 세로)을 바꾸면 새 해상도로 새 프로젝트가 시작되며,
              지금 편집 중인 내용은 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">취소</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => resolveOrientation(true)}
            >
              계속
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative min-h-0 flex-1">
        <LivePlayerProvider>
          <TimelineProvider
            initialData={INITIAL_TIMELINE_DATA}
            contextId="book-video-editor"
          >
            <TwickStudio
              studioConfig={{
                videoProps: { width: 1280, height: 720 },
                exportVideo: handleExportVideo,
                // "My assets"에 로컬 파일 업로드 활성화 — Twick의 gcs 방식(FormData "file" POST → { url }).
                // 우리 엔드포인트가 UPLOAD_ROOT에 저장하고 /uploads/... URL을 돌려준다.
                uploadConfig: {
                  uploadApiUrl: `${API_BASE_URL}/books/${bookId}/media-upload`,
                  provider: "gcs",
                },
              }}
            />
          </TimelineProvider>
        </LivePlayerProvider>

        {/* 컴포지션(렌더 해상도) 경계 — 캔버스 실제 사각형을 추적해 정확히 겹친다.
            pointer-events:none 으로 편집 조작을 막지 않고, 어두운 배경에서도 보이게 이중 링. */}
        <div
          ref={frameRef}
          aria-hidden
          className="pointer-events-none fixed z-[1] opacity-0"
          style={{
            outline: "1.5px solid rgba(129, 140, 248, 0.95)",
            boxShadow:
              "0 0 0 1px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(0, 0, 0, 0.35)",
          }}
        />

        {exportProgress != null ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <div className="flex w-72 flex-col items-center gap-3 rounded-lg border border-border bg-card px-5 py-4 shadow-lg">
              <div className="flex items-center gap-2">
                <Spinner className="size-4" />
                <span className="text-sm font-medium">
                  영상 렌더링 중… {Math.round(exportProgress * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{
                    width: `${Math.round(exportProgress * 100)}%`,
                  }}
                />
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                완료되면 미디어 라이브러리에 자동 등록됩니다.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
