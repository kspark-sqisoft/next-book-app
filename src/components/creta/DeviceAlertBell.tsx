"use client";

// 실시간 이상 단말 알림 벨 — 크레타 모든 페이지 헤더 우상단(일반 웹 알림 관례).
// 10초 폴링으로 디바이스 상태를 감시해 비정상·오프라인 전환을 이벤트로 쌓고,
// 확인 전 이벤트가 있으면 벨이 깜빡인다. 열면 현재 이상 단말 + 이전 알림 히스토리.
// 실제 푸시 채널이 없어 폴링 시뮬레이션이며, 히스토리는 브라우저(localStorage) 보관.
import { useQuery } from "@tanstack/react-query";
import { Bell, CircleAlert, CircleCheck, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type CretaDevice,
  cretaDeviceStatus,
  fetchCretaDevices,
} from "@/lib/creta-api";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

const HISTORY_KEY = "creta-device-alert-history";
const ACK_KEY = "creta-device-alert-ack-ts";
const HISTORY_MAX = 80;

type DeviceAlertEvent = {
  ts: number;
  deviceId: number;
  name: string;
  kind: "error" | "offline" | "recovered";
};

const KIND_LABEL: Record<DeviceAlertEvent["kind"], string> = {
  error: "비정상 신호",
  offline: "오프라인 전환",
  recovered: "정상 복귀",
};

function loadHistory(): DeviceAlertEvent[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is DeviceAlertEvent =>
        !!e &&
        typeof (e as DeviceAlertEvent).ts === "number" &&
        typeof (e as DeviceAlertEvent).deviceId === "number" &&
        typeof (e as DeviceAlertEvent).name === "string" &&
        ["error", "offline", "recovered"].includes(
          (e as DeviceAlertEvent).kind,
        ),
    );
  } catch {
    return [];
  }
}

function saveHistory(events: DeviceAlertEvent[]) {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(events.slice(0, HISTORY_MAX)),
    );
  } catch {
    /* ignore */
  }
}

function loadAckTs(): number {
  try {
    const n = Number(localStorage.getItem(ACK_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function formatEventTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DeviceAlertBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<DeviceAlertEvent[]>([]);
  const [ackTs, setAckTs] = useState(0);

  const { data: devices } = useQuery({
    queryKey: cretaKeys.devices(),
    queryFn: fetchCretaDevices,
    refetchInterval: 10_000,
    // 디바이스 목록은 로그인 필요 — 비로그인 상태에서 폴링하면 10초마다 실패한다
    enabled: !!user,
  });

  useEffect(() => {
    setHistory(loadHistory());
    setAckTs(loadAckTs());
  }, []);

  /** 상태 전환 감지 — 디바이스별 마지막 이벤트와 비교해 새 이벤트를 쌓는다 */
  useEffect(() => {
    if (!devices || devices.length === 0) return;
    const hist = loadHistory();
    const lastKind = new Map<number, DeviceAlertEvent["kind"]>();
    for (let i = hist.length - 1; i >= 0; i--) {
      lastKind.set(hist[i].deviceId, hist[i].kind);
    }
    const fresh: DeviceAlertEvent[] = [];
    const now = Date.now();
    for (const d of devices) {
      const st = cretaDeviceStatus(d);
      const prev = lastKind.get(d.id);
      if (st === "error" || st === "offline") {
        if (prev !== st) {
          fresh.push({ ts: now, deviceId: d.id, name: d.name, kind: st });
        }
      } else if (prev != null && prev !== "recovered") {
        fresh.push({
          ts: now,
          deviceId: d.id,
          name: d.name,
          kind: "recovered",
        });
      }
    }
    if (fresh.length > 0) {
      const next = [...fresh, ...hist].slice(0, HISTORY_MAX);
      saveHistory(next);
      setHistory(next);
    } else if (hist.length !== history.length) {
      setHistory(hist);
    }
    // history는 이 효과 안에서만 갱신 — devices 변화에만 반응
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);

  const problems: CretaDevice[] = (devices ?? []).filter(
    (d) => cretaDeviceStatus(d) !== "online",
  );
  /** 확인 전 이상 이벤트가 있으면 깜빡임 */
  const blinking = history.some((e) => e.kind !== "recovered" && e.ts > ackTs);

  const acknowledge = () => {
    const now = Date.now();
    setAckTs(now);
    try {
      localStorage.setItem(ACK_KEY, String(now));
    } catch {
      /* ignore */
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // 열어서 확인하면 깜빡임 중지(웹 알림 벨 관례)
        if (next) acknowledge();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            problems.length > 0
              ? `이상 단말 알림 ${problems.length}대`
              : "단말 알림"
          }
          className="relative shrink-0"
          data-testid="device-alert-bell"
        >
          <Bell
            className={cn(
              "size-4",
              blinking && "animate-pulse text-red-500",
              !blinking && problems.length > 0 && "text-amber-500",
            )}
            aria-hidden
          />
          {problems.length > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center"
              aria-hidden
            >
              {blinking ? (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500/70" />
              ) : null}
              <span className="relative flex size-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold leading-none text-white">
                {problems.length > 9 ? "9+" : problems.length}
              </span>
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        collisionPadding={8}
        className="z-[300] flex max-h-[70vh] w-[28rem] max-w-[calc(100vw-1rem)] flex-col gap-2 p-3"
        aria-label="실시간 단말 알림"
      >
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm font-semibold">실시간 단말 알림</p>
          <span className="text-[10px] text-muted-foreground">
            10초마다 상태 확인(시뮬레이션)
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">
            현재 이상 단말 {problems.length}대
          </p>
          {problems.length === 0 ? (
            <p className="rounded-md border border-border/60 bg-muted/20 px-2 py-3 text-center text-xs text-muted-foreground">
              모든 단말이 정상입니다.
            </p>
          ) : (
            problems.map((d) => {
              const st = cretaDeviceStatus(d);
              return (
                <Link
                  key={d.id}
                  href={`/devices/${d.id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
                    st === "error"
                      ? "border-red-500/40 bg-red-500/5"
                      : "border-zinc-500/30 bg-muted/20",
                  )}
                >
                  {st === "error" ? (
                    <CircleAlert
                      className="size-4 shrink-0 animate-pulse text-red-500"
                      aria-hidden
                    />
                  ) : (
                    <WifiOff
                      className="size-4 shrink-0 text-zinc-500"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {d.name}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {st === "error" ? "비정상" : "오프라인"} ·{" "}
                      {d.location || "위치 미지정"}
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </div>

        <div className="min-h-0 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">
            이전 알림
          </p>
          <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-border/60 p-1">
            {history.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                아직 기록된 알림이 없습니다.
              </p>
            ) : (
              history.slice(0, 30).map((e, i) => (
                <div
                  key={`${e.ts}-${e.deviceId}-${i}`}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/50"
                >
                  {e.kind === "recovered" ? (
                    <CircleCheck
                      className="size-3.5 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                  ) : e.kind === "error" ? (
                    <CircleAlert
                      className="size-3.5 shrink-0 text-red-500"
                      aria-hidden
                    />
                  ) : (
                    <WifiOff
                      className="size-3.5 shrink-0 text-zinc-500"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {e.name}{" "}
                    <span className="text-muted-foreground">
                      {KIND_LABEL[e.kind]}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {formatEventTime(e.ts)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
