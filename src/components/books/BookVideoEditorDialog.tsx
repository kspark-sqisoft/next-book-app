"use client";

// 비디오 편집 — Twick 스튜디오(멀티트랙 타임라인)를 전체 화면으로 띄우고,
// 내보내기는 브라우저 렌더(WebCodecs)로 MP4 Blob을 만들어 호출측(업로드·라이브러리)에 넘긴다
import "@twick/studio/dist/studio.css";

import { renderTwickVideoInBrowser } from "@twick/browser-render";
import { LivePlayerProvider } from "@twick/live-player";
import { TwickStudio } from "@twick/studio";
import { INITIAL_TIMELINE_DATA, TimelineProvider } from "@twick/timeline";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

declare global {
  interface Window {
    /**
     * @twick/studio 패치(patches/@twick+studio+…)가 orientation 변경 시 호출.
     * 기본 window.confirm 대신 아래 shadcn 확인 다이얼로그로 연결한다.
     */
    __twickConfirm?: (message: string) => Promise<boolean>;
  }
}

type Props = {
  onClose: () => void;
  /** 내보낸 MP4 파일 — 업로드·미디어 라이브러리 등록은 호출측 책임 */
  onExport: (file: File) => Promise<void>;
};

/** 대기 중인 orientation 확인 요청 — resolve로 사용자의 선택(계속/취소)을 라이브러리에 돌려준다 */
type OrientationConfirm = {
  resolve: (confirmed: boolean) => void;
};

export function BookVideoEditorDialog({ onClose, onExport }: Props) {
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [orientationConfirm, setOrientationConfirm] =
    useState<OrientationConfirm | null>(null);

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

  const handleExportVideo = useCallback(
    async (
      project: { tracks: unknown[] },
      videoSettings: {
        outFile: string;
        fps: number;
        resolution: { width: number; height: number };
      },
    ): Promise<{ status: boolean; message: string }> => {
      setExportProgress(0);
      try {
        const blob = await renderTwickVideoInBrowser({
          variables: {
            input: {
              properties: {
                width: videoSettings.resolution.width,
                height: videoSettings.resolution.height,
                fps: videoSettings.fps,
              },
              tracks: project.tracks,
            },
          },
          settings: {
            width: videoSettings.resolution.width,
            height: videoSettings.resolution.height,
            fps: videoSettings.fps,
            quality: "high",
            includeAudio: true,
            onProgress: (p) => setExportProgress(p),
          },
        });
        const name = videoSettings.outFile?.toLowerCase().endsWith(".mp4")
          ? videoSettings.outFile
          : "edited-video.mp4";
        await onExport(new File([blob], name, { type: "video/mp4" }));
        return {
          status: true,
          message: "미디어 라이브러리에 저장했습니다.",
        };
      } catch (e) {
        return { status: false, message: (e as Error).message };
      } finally {
        setExportProgress(null);
      }
    },
    [onExport],
  );

  /* 워크스페이스 패널·채팅(z≤3500)보다 위에 오도록 body 포털로 렌더 —
     내부에 두면 조상 스태킹 컨텍스트에 갇혀 기존 패널이 편집기를 가린다 */
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[5000] flex flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-3">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold">비디오 편집</h2>
          <p className="truncate text-[11px] text-muted-foreground">
            내보내기(Export) 시 렌더링 후 미디어 라이브러리에 저장됩니다 · 아래
            트랙일수록 화면 앞에 표시됩니다 · 렌더는 크롬·엣지 지원
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
              }}
            />
          </TimelineProvider>
        </LivePlayerProvider>

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
