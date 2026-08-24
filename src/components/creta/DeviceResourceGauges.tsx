import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type GaugeLevel = "good" | "warning" | "critical";

function gaugeLevel(pct: number): GaugeLevel {
  if (pct >= 90) return "critical";
  if (pct >= 70) return "warning";
  return "good";
}

const LEVEL_META: Record<
  GaugeLevel,
  { label: string; stroke: string; text: string; Icon: typeof CheckCircle2 }
> = {
  good: {
    label: "정상",
    stroke: "stroke-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  warning: {
    label: "주의",
    stroke: "stroke-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  critical: {
    label: "위험",
    stroke: "stroke-red-500",
    text: "text-red-600 dark:text-red-400",
    Icon: OctagonAlert,
  },
};

const SIZE = 104;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** 단일 값 원형(도넛) 게이지 — 값은 글자로도 표시하고 상태는 아이콘+라벨로 함께 표기(색만으로 구분하지 않음) */
export function DeviceResourceGauge({
  label,
  pct,
  detail,
}: {
  label: string;
  pct: number;
  /** 예: "3.2 / 8 GB" */
  detail?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const level = gaugeLevel(clamped);
  const meta = LEVEL_META[level];
  const dash = (clamped / 100) * CIRC;
  return (
    <figure
      className="flex flex-col items-center gap-1.5"
      aria-label={`${label} 사용률 ${clamped}% (${meta.label})`}
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-hidden
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-muted"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC - dash}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className={cn(
              "transition-[stroke-dasharray] duration-500",
              meta.stroke,
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums leading-none">
            {clamped}
            <span className="text-xs font-medium text-muted-foreground">%</span>
          </span>
        </div>
      </div>
      <figcaption className="text-center">
        <p className="text-sm font-medium">{label}</p>
        {detail ? (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {detail}
          </p>
        ) : null}
        <p
          className={cn(
            "mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold",
            meta.text,
          )}
        >
          <meta.Icon className="size-3" aria-hidden />
          {meta.label}
        </p>
      </figcaption>
    </figure>
  );
}

export function DeviceResourceGauges({
  cpuPct,
  ramPct,
  ssdPct,
  offline,
}: {
  cpuPct: number;
  ramPct: number;
  ssdPct: number;
  offline: boolean;
}) {
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "grid grid-cols-3 gap-2",
          offline && "opacity-60 grayscale-[0.4]",
        )}
      >
        <DeviceResourceGauge
          label="CPU"
          pct={cpuPct}
          detail={`${(cpuPct / 25).toFixed(1)} / 4 코어`}
        />
        <DeviceResourceGauge
          label="RAM"
          pct={ramPct}
          detail={`${((ramPct / 100) * 8).toFixed(1)} / 8 GB`}
        />
        <DeviceResourceGauge
          label="SSD"
          pct={ssdPct}
          detail={`${Math.round((ssdPct / 100) * 256)} / 256 GB`}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {offline
          ? "오프라인 — 마지막으로 보고된 값입니다."
          : "70% 이상 주의, 90% 이상 위험. "}
        더미 데이터이며 플레이어 연동 시 실제 값으로 바뀝니다.
      </p>
    </div>
  );
}
