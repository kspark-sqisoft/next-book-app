"use client";

// 원격 화면(시뮬레이션) — 원격 데스크톱 프로그램처럼 창을 띄우고
// 플랫폼(Windows/Android 등)에 맞는 가상 기기 화면 위에 플레이어 재생 화면을 보여준다.
import {
  Battery,
  Circle,
  MonitorSmartphone,
  Square,
  Triangle,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CretaAlertOverlay } from "@/components/creta/CretaAlertControls";
import { CretaCoverThumb } from "@/components/creta/CretaCoverThumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { CretaAlert } from "@/lib/creta-alerts-api";
import {
  type CretaDevice,
  deviceSimMeta,
  PLAY_SOURCE_LABEL,
} from "@/lib/creta-api";
import { cn } from "@/lib/utils";

/** 접속 연출 시간(ms) */
const CONNECT_MS = 1600;

/** 실시간 시계 — 가상 기기 상태바·작업표시줄에 표시 */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DeviceRemoteScreenDialog({
  device,
  activeAlert,
  alertCovers,
  previewThumb,
  open,
  onOpenChange,
}: {
  device: CretaDevice;
  activeAlert: CretaAlert | null;
  /** 활성 알림이 이 디바이스를 덮는지 */
  alertCovers: boolean;
  /** 현재 소스 커버 썸네일(데이터 URL) */
  previewThumb: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const meta = deviceSimMeta(device);
  const clock = useClock();
  const [connected, setConnected] = useState(false);

  // 열 때마다 접속 연출부터 다시 — effect 안 동기 setState로 인한 연쇄 렌더 방지(microtask)
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setConnected(false));
    if (!device.online) return; // 오프라인은 연결 실패 화면 유지
    const t = window.setTimeout(() => setConnected(true), CONNECT_MS);
    return () => window.clearTimeout(t);
  }, [open, device.online]);

  const isMobileLike =
    device.platform === "Android" ||
    device.platform === "WebOS" ||
    device.platform === "Tizen";
  const remoteInput = (label: string) =>
    toast.info(`원격 입력 전송(시뮬레이션): ${label}`);

  /** 플레이어 재생 화면(공통) — 긴급 알림이 덮고 있으면 알림 표시 */
  const playerScreen = (
    <div className="relative size-full overflow-hidden bg-black">
      {alertCovers && activeAlert ? (
        <CretaAlertOverlay alert={activeAlert} />
      ) : device.source ? (
        <>
          {previewThumb ? (
            <CretaCoverThumb
              dataUrl={previewThumb}
              title={device.source.title}
              className="absolute inset-0 size-full"
            />
          ) : null}
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-[10px] text-white">
            Creta Player {device.playerVersion} ·{" "}
            {PLAY_SOURCE_LABEL[device.source.kind]} · {device.source.title}
          </span>
        </>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
          지정된 재생 소스 없음
        </span>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 기본 다이얼로그(2xl=672px)의 2배 폭 — 화면이 좁으면 뷰포트에 맞춰 줄어든다 */}
      <DialogContent className="max-h-[92vh] gap-3 overflow-y-auto sm:max-w-[min(84rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorSmartphone
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            Creta Remote — {device.name}
            <span
              className={cn(
                "ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                device.online && connected
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-zinc-500/15 text-zinc-500",
              )}
            >
              <Circle
                className={cn(
                  "size-2 fill-current",
                  device.online && connected
                    ? "text-emerald-500"
                    : "text-zinc-400",
                )}
                aria-hidden
              />
              {device.online
                ? connected
                  ? "연결됨"
                  : "연결 중"
                : "연결 안 됨"}
            </span>
          </DialogTitle>
          <DialogDescription>
            {meta.ip}:5900 · {device.platform} · {device.resolution} — 가상 기기
            화면(시뮬레이션)
          </DialogDescription>
        </DialogHeader>

        {/* 가상 기기 화면 */}
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border-4 border-zinc-800 bg-black shadow-inner",
            // 세로형 기기는 높이 기준으로 9:16 비율 유지, 그 외는 다이얼로그 폭에 맞춘 16:9
            isMobileLike && device.orientation === "세로"
              ? "mx-auto aspect-[9/16] h-[74vh] w-auto max-w-full"
              : "aspect-video w-full",
          )}
          data-testid="remote-screen"
        >
          {!device.online ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
              <X className="size-8" aria-hidden />
              <p className="text-sm">연결할 수 없습니다 — 디바이스 오프라인</p>
            </div>
          ) : !connected ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-300">
              <Spinner className="size-7" />
              <p className="text-sm">{meta.ip}:5900 에 연결 중…</p>
              <p className="text-[11px] text-zinc-500">
                화면 스트림 협상(시뮬레이션)
              </p>
            </div>
          ) : isMobileLike ? (
            /* Android·WebOS·Tizen — 상태바 + 전체 화면 플레이어 + 내비 바 */
            <div className="absolute inset-0 flex flex-col">
              <div className="flex shrink-0 items-center justify-between bg-black/90 px-2 py-1 text-[10px] text-zinc-300">
                <span>{clock}</span>
                <span className="flex items-center gap-1.5">
                  <Wifi className="size-3" aria-hidden />
                  <Battery className="size-3.5" aria-hidden />
                  87%
                </span>
              </div>
              <div className="relative min-h-0 flex-1">{playerScreen}</div>
              {device.platform === "Android" ? (
                <div className="flex shrink-0 items-center justify-center gap-10 bg-black/90 py-1.5 text-zinc-400">
                  <button
                    type="button"
                    aria-label="뒤로"
                    className="hover:text-white"
                    onClick={() => remoteInput("뒤로")}
                  >
                    <Triangle
                      className="size-3.5 -rotate-90 fill-current"
                      aria-hidden
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="홈"
                    className="hover:text-white"
                    onClick={() => remoteInput("홈")}
                  >
                    <Circle className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="최근 앱"
                    className="hover:text-white"
                    onClick={() => remoteInput("최근 앱")}
                  >
                    <Square className="size-3" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            /* Windows — 데스크톱 + 플레이어 창 + 작업표시줄 */
            <div className="absolute inset-0 flex flex-col bg-gradient-to-br from-sky-900 via-slate-900 to-slate-950">
              <div className="relative min-h-0 flex-1 p-3">
                <div className="flex h-full flex-col overflow-hidden rounded-md border border-zinc-700 shadow-2xl">
                  <div className="flex shrink-0 items-center justify-between bg-zinc-800 px-2 py-1">
                    <span className="text-[10px] font-medium text-zinc-200">
                      Creta Player {device.playerVersion} — 전체 화면 재생
                    </span>
                    <span className="flex items-center gap-1 text-zinc-400">
                      <span className="size-2 rounded-full bg-amber-400/80" />
                      <span className="size-2 rounded-full bg-emerald-400/80" />
                      <span className="size-2 rounded-full bg-red-400/80" />
                    </span>
                  </div>
                  <div className="relative min-h-0 flex-1">{playerScreen}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between bg-zinc-900/95 px-2 py-1 text-zinc-300">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-white/10"
                  onClick={() => remoteInput("시작 메뉴")}
                >
                  <span className="grid size-3.5 grid-cols-2 gap-px">
                    <span className="bg-sky-400" />
                    <span className="bg-sky-400" />
                    <span className="bg-sky-400" />
                    <span className="bg-sky-400" />
                  </span>
                  시작
                </button>
                <span className="text-[10px] tabular-nums">{clock}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            화면을 조작하면 원격 입력이 전송됩니다(시뮬레이션).
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!device.online || !connected}
              onClick={() =>
                remoteInput(isMobileLike ? "화면 탭" : "Ctrl+Alt+Del")
              }
            >
              {isMobileLike ? "화면 탭" : "Ctrl+Alt+Del"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onOpenChange(false)}
            >
              연결 끊기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
