import {
  AlertTriangle,
  CheckCircle2,
  OctagonAlert,
  ScrollText,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  type CretaDevice,
  WEEKDAY_SHORT_LABEL,
} from "@/features/creta/creta-api";
import {
  buildDeviceSampleLog,
  DEVICE_SAMPLE_LOG_LEVEL_LABEL,
  type DeviceSampleLogLevel,
  recentDeviceLogDateKeys,
} from "@/features/creta/device-sample-log";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<
  DeviceSampleLogLevel,
  { badge: string; Icon: typeof CheckCircle2; row: string }
> = {
  info: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    Icon: CheckCircle2,
    row: "",
  },
  warn: {
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
    row: "bg-amber-500/5",
  },
  error: {
    badge: "bg-red-500/15 text-red-700 dark:text-red-400",
    Icon: OctagonAlert,
    row: "bg-red-500/5",
  },
};

const DAYS = 7;

/** "YYYY-MM-DD" → "M/D (요일)" */
function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return `${m}/${d} (${WEEKDAY_SHORT_LABEL[dt.getDay()]})`;
}

/**
 * 디바이스 상세 하단 "로그" — 정상 작동/문제 발생을 한눈에 보기 위한 예시 이벤트 로그(실제 수집값 아님).
 * 기본은 오늘, 최근 7일 중 하루를 골라 볼 수 있다(날짜마다 내용이 다름).
 */
export function DeviceSampleLogCard({ device }: { device: CretaDevice }) {
  // 마운트 시점의 오늘 기준 7일. 자정에 걸치면 새로고침으로 갱신
  const [dateKeys] = useState(() => recentDeviceLogDateKeys(DAYS));
  const [selected, setSelected] = useState(0);
  const todayKey = dateKeys[0]!;
  const dateKey = dateKeys[selected] ?? todayKey;

  const entries = useMemo(
    () =>
      buildDeviceSampleLog({
        deviceId: device.id,
        online: device.online,
        powerOnTime: device.powerOnTime,
        powerOffTime: device.powerOffTime,
        sourceTitle: device.source?.title ?? null,
        date: dateKey,
      }),
    [
      device.id,
      device.online,
      device.powerOnTime,
      device.powerOffTime,
      device.source?.title,
      dateKey,
    ],
  );
  const counts = entries.reduce(
    (acc, e) => ({ ...acc, [e.level]: acc[e.level] + 1 }),
    { info: 0, warn: 0, error: 0 } as Record<DeviceSampleLogLevel, number>,
  );

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ScrollText className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold">로그</p>
            <span className="text-xs text-muted-foreground">
              오늘 {todayKey}
              {selected !== 0 ? ` · 보는 날 ${dateKey}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["info", "warn", "error"] as const).map((lv) => {
              const s = LEVEL_STYLE[lv];
              return (
                <Badge key={lv} className={cn("gap-1", s.badge)}>
                  <s.Icon className="size-3" aria-hidden />
                  {DEVICE_SAMPLE_LOG_LEVEL_LABEL[lv]} {counts[lv]}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* 최근 7일 선택 — 최신(오늘)이 왼쪽 */}
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="로그 날짜(최근 7일)"
        >
          {dateKeys.map((key, i) => {
            const active = i === selected;
            const label = i === 0 ? "오늘" : i === 1 ? "어제" : shortDate(key);
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                title={key}
                onClick={() => setSelected(i)}
                className={cn(
                  "h-7 rounded-md border px-2 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
                {i <= 1 ? (
                  <span className="ml-1 opacity-70">{shortDate(key)}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          예시 데이터입니다(실제 수집 로그 아님). 기동·네트워크·콘텐츠 로드·종료
          이벤트를 시간순으로 보여 주며, 경고·이상 행은 배경색과 아이콘으로
          구분됩니다.
        </p>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">시각</th>
                <th className="px-3 py-2 text-left font-medium">상태</th>
                <th className="px-3 py-2 text-left font-medium">이벤트</th>
                <th className="px-3 py-2 text-left font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const s = LEVEL_STYLE[e.level];
                return (
                  <tr
                    key={`${dateKey}-${e.time}-${e.event}-${i}`}
                    className={cn("border-t border-border", s.row)}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                      {e.time}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={cn("gap-1", s.badge)}>
                        <s.Icon className="size-3" aria-hidden />
                        {DEVICE_SAMPLE_LOG_LEVEL_LABEL[e.level]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                      {e.event}
                    </td>
                    <td className="px-3 py-2">{e.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
