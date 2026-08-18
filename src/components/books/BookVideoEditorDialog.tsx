"use client";

// 비디오 편집 — Twick 스튜디오(멀티트랙 타임라인)를 전체 화면으로 띄우고,
// 내보내기(Export)는 서버측 헤드리스 Chromium 렌더에 위임한다(브라우저를 붙잡지 않음).
// 진행률은 잡 폴링으로 받아오고, 완료 시 결과 URL을 호출측(미디어 라이브러리 등록)에 넘긴다.
import "@twick/studio/dist/studio.css";

import { LivePlayerProvider } from "@twick/live-player";
import { TwickStudio } from "@twick/studio";
import { INITIAL_TIMELINE_DATA, TimelineProvider } from "@twick/timeline";
import { Maximize2, Minus, Plus, X } from "lucide-react";
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

type Rect = { top: number; bottom: number; left: number; right: number };

/** 화면 맞춤 시 컴포지션이 뷰를 꽉 채우지 않게 남기는 여백 비율(0.9 → 상하좌우 약 5%씩) */
const FIT_MARGIN_RATIO = 0.9;

/** 초기 타임라인 — 라이브러리 기본 샘플 문구("Twick SDK")를 우리 브랜드로 교체 */
const CRETA_INITIAL_TIMELINE_DATA: typeof INITIAL_TIMELINE_DATA = {
  tracks: [
    {
      type: "element",
      id: "t-sample",
      name: "sample",
      elements: [
        {
          id: "e-sample",
          trackId: "t-sample",
          name: "sample",
          type: "text",
          s: 0,
          e: 5,
          props: { text: "Creta Studio", fill: "#FFFFFF" },
        },
      ],
    },
  ],
  version: 1,
};

/**
 * 출력 해상도 = 편집 컴포지션(1280×720 16:9) × 화질 배율(quality).
 * browser-render는 scene 좌표계를 컴포지션 크기로 유지하고 resolutionScale만 키우므로,
 * 레이아웃이 깨지지 않고 안전하게 업스케일된다. (low=1×, medium=1.5×, high=2×)
 */
const EXPORT_QUALITIES = [
  { id: "medium", label: "FHD · 1080p" },
  { id: "high", label: "QHD · 1440p" },
  { id: "low", label: "HD · 720p" },
] as const;
type ExportQuality = (typeof EXPORT_QUALITIES)[number]["id"];

/**
 * 실제로 보이는 컴포지션 뷰 영역(안전 영역)과 현재 캔버스 사각형을 구한다.
 * 안전 영역 = 좌우는 뷰 섹션(패널 사이), 위는 Creta 상단 바 아래, 아래는 타임라인 위.
 * 캔버스가 뷰보다 커져 헤더/타임라인 위로 넘칠 때 툴바 배치·프레임 클립·맞춤 계산의 공통 기준.
 */
function getViewGeometry(
  root: HTMLElement,
): { safe: Rect; canvas: DOMRect | null } | null {
  const view = root.querySelector(".twick-editor-view-section");
  if (!view) return null;
  const vr = view.getBoundingClientRect();
  // 우리 앱 헤더는 포털 루트의 직속 <header>; 그 외 <header>가 Twick(Creta) 상단 바.
  const appHeader = root.querySelector(":scope > header");
  const cretaBar = Array.from(root.querySelectorAll("header"))
    .find((h) => h !== appHeader)
    ?.getBoundingClientRect();
  const timeline = root
    .querySelector(".twick-editor-timeline-section")
    ?.getBoundingClientRect();
  const top = Math.max(vr.top, cretaBar ? cretaBar.bottom : vr.top);
  const bottom = Math.min(vr.bottom, timeline ? timeline.top : vr.bottom);
  return {
    safe: { top, bottom, left: vr.left, right: vr.right },
    canvas: getCompositionRect(root),
  };
}

/**
 * 실제 컴포지션(렌더 해상도) 영역을 화면 좌표로 구한다.
 * 캔버스 CSS 박스는 뷰 모양에 따라 컴포지션보다 크게(레터박스 포함) 잡힐 수 있으므로,
 * 캔버스 내부 버퍼 비율(= 컴포지션 종횡비)을 CSS 박스 안에 contain 시킨 중앙 영역을 돌려준다.
 * 레터박스가 없으면 박스와 동일. 이 영역이 경계 프레임·맞춤 계산의 진짜 기준이다.
 */
function getCompositionRect(root: HTMLElement): DOMRect | null {
  const canvas = root.querySelector<HTMLCanvasElement>(
    ".twick-editor-canvas-container canvas",
  );
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  // 내부 버퍼(canvas.width/height)가 컴포지션 해상도(×pixelRatio) → 그 종횡비가 컴포지션 종횡비.
  const aspect =
    canvas.width > 0 && canvas.height > 0
      ? canvas.width / canvas.height
      : r.width / r.height;
  let w = r.width;
  let h = r.width / aspect;
  if (h > r.height) {
    h = r.height;
    w = r.height * aspect;
  }
  const x = r.left + (r.width - w) / 2;
  const y = r.top + (r.height - h) / 2;
  return new DOMRect(x, y, w, h);
}

export function BookVideoEditorDialog({ onClose, bookId, onRendered }: Props) {
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportQuality, setExportQuality] = useState<ExportQuality>("medium");
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [orientationConfirm, setOrientationConfirm] =
    useState<OrientationConfirm | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // 중앙 뷰 줌 — 버튼/휠/퍼센트 표시가 한 값을 공유. zoomRef는 이벤트 핸들러가 최신값을 읽기 위한 미러.
  const [viewZoom, setViewZoom] = useState(1);
  const zoomRef = useRef(1);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4;
  const applyViewZoom = useCallback((next: number) => {
    let z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (Math.abs(z - 1) < 0.05) z = 1; // 100% 스냅
    zoomRef.current = z;
    setViewZoom(z);
    rootRef.current?.style.setProperty("--twick-view-zoom", String(z));
  }, []);

  // 화면 맞춤 — 100% 강제가 아니라, 컴포지션(원본 크기)이 안전 뷰 영역에 들어가는 배율을 계산.
  // 원본 크기 = 현재 캔버스 사각형 ÷ 현재 줌. 여백(pad)만큼 줄여 가장자리에 딱 붙지 않게 한다.
  const fitToView = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const geo = getViewGeometry(root);
    if (
      !geo ||
      !geo.canvas ||
      geo.canvas.width <= 0 ||
      geo.canvas.height <= 0
    ) {
      applyViewZoom(1);
      return;
    }
    const availW = geo.safe.right - geo.safe.left;
    const availH = geo.safe.bottom - geo.safe.top;
    const zoom = zoomRef.current || 1;
    const naturalW = geo.canvas.width / zoom;
    const naturalH = geo.canvas.height / zoom;
    if (availW <= 0 || availH <= 0 || naturalW <= 0 || naturalH <= 0) {
      applyViewZoom(1);
      return;
    }
    // 여백 비율 — 컴포지션이 뷰에 꽉 차지 않게 항상 여백을 둬서 경계선이 늘 보이고,
    // 캔버스가 뷰 경계와 겹쳐 서브픽셀 흔들림으로 깜빡이는 것도 막는다.
    const fit =
      Math.min(availW / naturalW, availH / naturalH) * FIT_MARGIN_RATIO;
    applyViewZoom(fit);
  }, [applyViewZoom]);

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
      applyViewZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      root.removeEventListener("wheel", onWheel);
      root.style.removeProperty("--twick-view-zoom");
    };
  }, [applyViewZoom]);

  // 편집기 열 때 자동 맞춤 — 캔버스가 준비되면 여백 있는 배율로 한 번 맞춰, 열자마자
  // 경계선이 보이고 컴포지션이 뷰에 꽉 차 깜빡이지 않게 한다(캔버스 등장까지 폴링).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    let tries = 0;
    const tryFit = () => {
      const geo = getViewGeometry(root);
      if (geo?.canvas && geo.canvas.width > 0 && geo.canvas.height > 0) {
        fitToView();
        return;
      }
      if (tries++ < 180) raf = requestAnimationFrame(tryFit);
    };
    raf = requestAnimationFrame(tryFit);
    return () => cancelAnimationFrame(raf);
  }, [fitToView]);

  // 줌 툴바를 안전 뷰 영역 상단 가운데(Creta 상단 바 아래, 패널 사이 중앙)에 매 프레임 고정.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    const tick = () => {
      const safe = getViewGeometry(root)?.safe;
      const toolbar = toolbarRef.current;
      if (toolbar && safe) {
        toolbar.style.left = `${Math.round((safe.left + safe.right) / 2)}px`;
        toolbar.style.top = `${Math.round(safe.top + 8)}px`;
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
          // 출력 해상도 = 컴포지션 크기 × quality 배율(scene 좌표계는 유지 → 레이아웃 안전)
          { width, height, fps, quality: exportQuality, includeAudio: true },
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
    [bookId, onRendered, exportQuality],
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
               CSS 변수로 적용해 Twick 리렌더가 인라인 스타일을 덮어써도 유지된다(휠 핸들러가 변수만 갱신).
               .twick-editor-container(편집 캔버스+라이브 플레이어의 공통 부모)에 걸어야 재생/정지 배율이 일치한다.
               (canvas-container에만 걸면 정지=Fabric만 축소되고 재생=twick-player는 원본 크기로 커 보임) */
            .twick-editor-container {
              transform: scale(var(--twick-view-zoom, 1)) !important;
              transform-origin: center center !important;
              /* 컴포지션 원래 비율(16:9) 유지 — 편집(Fabric)·재생(Konva) 공통 부모를 이 비율로 고정하면
                 둘 다 16:9로 렌더돼 재생/정지가 일치하고, 뷰가 세로로 길어도 찌그러지지 않는다.
                 뷰 안에 들어가도록 max로 제한하고 margin:auto로 중앙 배치(남는 공간은 어두운 여백). */
              aspect-ratio: var(--twick-comp-aspect, 16 / 9) !important;
              width: 100% !important;
              height: auto !important;
              max-height: 100% !important;
              margin: auto !important;
            }
            /* 컴포지션 모서리 각지게 — Twick 기본 라운딩(container 10px, canvas-container 12px) 제거 */
            .twick-editor-container,
            .canvas-container {
              border-radius: 0 !important;
            }
            /* 라이브러리 아이템 버튼 겹침 방지 — 16:9 짧은 타일에서 재생(하단우) 버튼이 상단우 +·휴지통과
               겹쳤다. 재생 버튼을 좌하단으로 옮겨 대각선으로 분리(타일 크기와 무관하게 안 겹침). */
            .media-item .media-actions-corner-bottom {
              inset: auto auto 6px 6px !important;
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
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            출력 해상도
            <select
              value={exportQuality}
              onChange={(e) =>
                setExportQuality(e.target.value as ExportQuality)
              }
              disabled={exportProgress != null}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground disabled:opacity-50"
              title="내보내기(Export) 시 만들어질 영상 해상도"
            >
              {EXPORT_QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            disabled={exportProgress != null}
            onClick={() => setExitConfirmOpen(true)}
          >
            <X className="mr-1.5 size-3.5" aria-hidden />
            나가기
          </Button>
        </div>
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

      <div className="relative min-h-0 flex-1 pb-4">
        <LivePlayerProvider>
          <TimelineProvider
            initialData={CRETA_INITIAL_TIMELINE_DATA}
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

        {/* 뷰 줌 컨트롤 — 북 편집기처럼 −/+ 로 확대·축소, "맞춤"으로 가용 크기(100%)에 한 번에 맞춤.
            퍼센트 클릭으로도 100% 복귀. 휠 줌과 같은 값을 공유한다(z는 export 오버레이 아래).
            위치는 rAF로 뷰 영역 상단 가운데에 고정(left/top은 imperative, translateX(-50%)로 중앙 정렬). */}
        <div
          ref={toolbarRef}
          className="fixed z-[3] flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-card/90 p-1 shadow-md backdrop-blur"
          style={{ left: 0, top: 0 }}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            title="축소"
            aria-label="축소"
            disabled={viewZoom <= MIN_ZOOM}
            onClick={() => applyViewZoom(zoomRef.current / 1.1)}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <button
            type="button"
            className="min-w-[3.25rem] rounded px-1 py-0.5 text-center text-xs font-medium tabular-nums hover:bg-muted"
            title="화면에 맞춤"
            onClick={fitToView}
          >
            {Math.round(viewZoom * 100)}%
          </button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            title="확대"
            aria-label="확대"
            disabled={viewZoom >= MAX_ZOOM}
            onClick={() => applyViewZoom(zoomRef.current * 1.1)}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
          <div className="mx-0.5 h-4 w-px bg-border" aria-hidden />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            title="화면 맞춤"
            aria-label="화면 맞춤"
            onClick={fitToView}
          >
            <Maximize2 className="size-4" aria-hidden />
          </Button>
        </div>

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
