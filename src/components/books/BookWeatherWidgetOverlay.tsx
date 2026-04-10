// 북 날씨 위젯: OWM 쿼리·아이콘 매핑·표시 옵션
import { useQuery } from "@tanstack/react-query";
import {
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  type LucideIcon,
  Moon,
  Sun,
} from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import { fetchWeatherCurrent, type SeoulWeatherPayload } from "@/lib/api";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  type BookWeatherDisplayResolved,
  bookWidgetBackdropChromeStyle,
  parseBookWeatherBackground,
  parseBookWidgetTextColor,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
  resolveBookWeatherDisplay,
} from "@/lib/book-canvas";
import { cn } from "@/lib/utils";

type Props = {
  el: Extract<BookCanvasElement, { type: "weather" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

type VisualKind =
  | "clear-day"
  | "clear-night"
  | "cloudy-day"
  | "cloudy-night"
  | "rain"
  | "storm"
  | "snow"
  | "mist";

type LayoutVariant =
  | "standard"
  | "minimal"
  | "air-only"
  | "split-air"
  | "time-only";

function visualKindFromOwmIcon(icon: string): VisualKind {
  const code = icon.slice(0, 2);
  const night = icon.endsWith("n");
  if (code === "01") return night ? "clear-night" : "clear-day";
  if (code === "13") return "snow";
  if (code === "09" || code === "10") return "rain";
  if (code === "11") return "storm";
  if (code === "50") return "mist";
  if (night) return "cloudy-night";
  return "cloudy-day";
}

/** 슬라이드에 표시되는 동안 주기 갱신(같은 도시 쿼리 키는 하나로 합쳐짐). 탭이 백그라운드면 갱신 안 함. */
const WEATHER_REFETCH_INTERVAL_MS = 5 * 60_000;

const WEATHER_LINE_ICONS: Record<VisualKind, LucideIcon> = {
  "clear-day": Sun,
  "clear-night": Moon,
  "cloudy-day": CloudSun,
  "cloudy-night": CloudMoon,
  rain: CloudRain,
  storm: CloudLightning,
  snow: CloudSnow,
  mist: CloudFog,
};

function useTickNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatPmShort(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v)}`;
}

function pickLayoutVariant(d: BookWeatherDisplayResolved): LayoutVariant {
  const weatherCore =
    d.temp || d.feelsLike || d.description || d.icon || d.humidity || d.wind;
  const nAir = (d.pm25 ? 1 : 0) + (d.pm10 ? 1 : 0) + (d.aqi ? 1 : 0);
  if (!weatherCore && nAir > 0) return "air-only";
  /** 날씨·대기 숫자 없이 시계/날짜만 — 2열 그리드 빈 칸 방지 */
  if (!weatherCore && nAir === 0 && (d.clock || d.date)) return "time-only";
  if (weatherCore && nAir >= 2) return "split-air";
  if (weatherCore && nAir === 0 && !d.clock && !d.date) return "minimal";
  return "standard";
}

/** 공통: 메시 그라데이션 + 가장자리 비네트 */
function BackdropMesh({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_10%_0%,rgba(255,255,255,0.22),transparent_52%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_100%,rgba(255,255,255,0.12),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.18)_100%)]" />
    </div>
  );
}

function CardBackdrop({ kind }: { kind: VisualKind }) {
  switch (kind) {
    case "clear-day":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(128deg, #ff8a5c 0%, #ffb347 28%, #ffd89b 52%, #ff9a76 100%)",
            }}
          />
          <BackdropMesh />
          <div
            className="absolute -right-[18%] -top-[22%] size-[72%] rounded-full bg-amber-100/40 blur-3xl"
            aria-hidden
          />
        </>
      );
    case "clear-night":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(168deg, #0c1222 0%, #1a1f4a 38%, #251d47 72%, #0f172a 100%)",
            }}
          />
          <BackdropMesh className="opacity-80" />
          {[
            [12, 8],
            [28, 18],
            [72, 12],
            [88, 22],
            [18, 38],
            [55, 28],
            [82, 42],
            [40, 48],
          ].map(([l, t], i) => (
            <span
              key={i}
              className="absolute size-[3px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.95)]"
              style={{
                left: `${l}%`,
                top: `${t}%`,
                opacity: 0.55 + (i % 3) * 0.12,
              }}
              aria-hidden
            />
          ))}
          <div
            className="absolute -right-[4%] top-[6%] size-[36%] rounded-full border-[0.14em] border-amber-100/55 border-r-transparent border-b-transparent border-l-transparent rotate-[-22deg]"
            style={{ boxShadow: "inset 0 0 1.2em rgba(254,243,199,0.12)" }}
            aria-hidden
          />
        </>
      );
    case "cloudy-day":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(152deg, #5b7c9a 0%, #4f8ad6 45%, #2563eb 78%, #1e40af 100%)",
            }}
          />
          <BackdropMesh />
          <div
            className="absolute -bottom-[12%] inset-x-[-8%] h-[42%] rounded-[100%] bg-slate-950/20 blur-xl"
            aria-hidden
          />
        </>
      );
    case "cloudy-night":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(158deg, #1a2332 0%, #2d325a 48%, #1e3a5f 100%)",
            }}
          />
          <BackdropMesh className="opacity-90" />
          <div
            className="absolute inset-x-0 bottom-0 h-[42%] bg-linear-to-t from-black/45 to-transparent"
            aria-hidden
          />
        </>
      );
    case "rain":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(162deg, #3d4f63 0%, #1d4e89 38%, #0c4a6e 72%, #082f49 100%)",
            }}
          />
          <BackdropMesh className="opacity-75" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-18deg, transparent, transparent 6px, rgba(255,255,255,0.04) 6px, rgba(255,255,255,0.04) 7px)",
            }}
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[38%] bg-linear-to-t from-slate-950/55 to-transparent"
            aria-hidden
          />
        </>
      );
    case "storm":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(168deg, #2c3544 0%, #3730a3 32%, #1e1b4b 68%, #0f172a 100%)",
            }}
          />
          <BackdropMesh />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_25%_5%,rgba(250,204,21,0.18),transparent_55%)]"
            aria-hidden
          />
        </>
      );
    case "snow":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(148deg, #dbeafe 0%, #f0f9ff 40%, #93c5fd 88%, #bfdbfe 100%)",
            }}
          />
          <BackdropMesh className="opacity-50 mix-blend-overlay" />
          {[
            [10, 15, 0.5],
            [78, 22, 0.4],
            [45, 8, 0.55],
            [88, 55, 0.35],
            [22, 62, 0.45],
            [65, 70, 0.4],
          ].map(([l, t, op], i) => (
            <span
              key={i}
              className="pointer-events-none absolute text-white"
              style={{
                left: `${l}%`,
                top: `${t}%`,
                opacity: op,
                fontSize: "0.65em",
                textShadow: "0 0 8px rgba(255,255,255,1)",
              }}
              aria-hidden
            >
              ✦
            </span>
          ))}
        </>
      );
    case "mist":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(188deg, #a8b8c8 0%, #7c8c9c 45%, #5a6570 100%)",
            }}
          />
          <BackdropMesh className="opacity-40" />
        </>
      );
    default:
      return (
        <>
          <div
            className="absolute inset-0 bg-linear-to-br from-sky-500 via-indigo-600 to-violet-900"
            aria-hidden
          />
          <BackdropMesh />
        </>
      );
  }
}

/** 대기질 전용 카드 배경 (날씨 아이콘 테마와 별도) */
function AirQualityBackdrop({ aqiLevel }: { aqiLevel: number | null }) {
  const tier = aqiLevel == null ? 0 : Math.min(5, Math.max(1, aqiLevel));
  const hue =
    tier <= 1
      ? "from-emerald-950 via-teal-950 to-slate-950"
      : tier === 2
        ? "from-slate-900 via-cyan-950 to-slate-950"
        : tier === 3
          ? "from-amber-950 via-stone-900 to-slate-950"
          : "from-rose-950 via-purple-950 to-slate-950";
  return (
    <div className={cn("absolute inset-0 bg-linear-to-br", hue)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_0%_0%,rgba(52,211,153,0.2),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_100%,rgba(255,255,255,0.08),transparent_50%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-black/40 to-transparent" />
    </div>
  );
}

function aqiAccentClass(aqiLevel: number | null): string {
  const t = aqiLevel == null ? 0 : Math.min(5, Math.max(1, aqiLevel));
  if (t <= 1) return "text-emerald-200";
  if (t === 2) return "text-cyan-200";
  if (t === 3) return "text-amber-200";
  return "text-rose-200";
}

export function BookWeatherWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
}: Props) {
  const qNorm = el.cityQuery?.trim() ?? "";
  const disp = resolveBookWeatherDisplay(el.weatherDisplay);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["weather", "current", qNorm],
    queryFn: () => fetchWeatherCurrent(qNorm || null),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchInterval: WEATHER_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const now = useTickNow();
  const timeStr = useMemo(
    () =>
      now.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [now],
  );
  const dateStr = useMemo(
    () =>
      now.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }),
    [now],
  );

  const w = el.width;
  const h = el.height;
  const o = resolveBookElementOpacity(el.opacity);
  const rot = resolveBookElementRotation(el.rotation);
  const pivot = bookElementPivotKonva({
    x: el.x,
    y: el.y,
    width: w,
    height: h,
    rotation: el.rotation,
  });
  const layoutOrigin = bookElementOverlayTopLeftFromPivot(pivot, w, h);
  const fx = liveFrame?.x ?? layoutOrigin.x;
  const fy = liveFrame?.y ?? layoutOrigin.y;
  const fw = liveFrame?.width ?? w;
  const fh = liveFrame?.height ?? h;
  const fRot = liveFrame != null ? liveFrame.rotation : rot;

  const lh = fh;
  const lw = fw;
  const boxH = lh * scale;
  const boxW = lw * scale;
  /**
   * 논리 크기가 작은 위젯만 글자·아이콘을 줄임. 캔버스 배율만 키운 경우(boxH 큼)에는 그대로 비율 확대.
   */
  const fitShrink = Math.min(
    1,
    Math.max(0.68, Math.min(boxH / 200, boxW / 260)),
  );

  const errMsg =
    error instanceof Error ? error.message : "불러오지 못했습니다.";

  const kind = data ? visualKindFromOwmIcon(data.icon || "02d") : "cloudy-day";
  const LineIcon = WEATHER_LINE_ICONS[kind];
  const variant = data ? pickLayoutVariant(disp) : "standard";

  /**
   * 논리 비율로 키우되, 실제 박스(boxH/boxW) 안에 레이아웃이 들어가도록 화면 픽셀 상한을 둔다.
   * (기본 364×256 등에서 잘림·스크롤 없이 전체가 보이게)
   */
  const condSize = Math.round(
    Math.max(9 * scale, Math.min(lh * 0.14 * scale * fitShrink, boxH * 0.078)),
  );
  const tempSize = Math.round(
    Math.max(13 * scale, Math.min(lh * 0.36 * scale * fitShrink, boxH * 0.19)),
  );
  const tempSizeMinimal = Math.round(
    Math.max(14 * scale, Math.min(lh * 0.48 * scale * fitShrink, boxH * 0.24)),
  );
  const clockSize = Math.round(
    Math.max(10 * scale, Math.min(lh * 0.2 * scale * fitShrink, boxH * 0.092)),
  );
  const bodySize = Math.round(
    Math.max(7 * scale, Math.min(lh * 0.085 * scale * fitShrink, boxH * 0.042)),
  );
  /** 대기(PM·AQI) 전용 — 본문보다 한 단계 크게 */
  const airTextSize = Math.max(
    8 * scale,
    Math.min(bodySize * 1.18, boxH * 0.048),
  );
  const aqiHuge = Math.round(
    Math.max(16 * scale, Math.min(lh * 0.42 * scale * fitShrink, boxH * 0.26)),
  );
  const chromePad = Math.max(
    4 * scale,
    Math.min(Math.max(6 * scale, bodySize * 0.88), boxH * 0.036),
  );
  const iconShellPad = Math.max(3 * scale, Math.min(8 * scale, boxH * 0.028));
  const pillPadX = Math.max(6 * scale, Math.min(12 * scale, boxW * 0.028));
  const pillPadY = Math.max(3 * scale, Math.min(7 * scale, boxH * 0.024));
  const pillPadStyle: CSSProperties = {
    paddingLeft: pillPadX,
    paddingRight: pillPadX,
    paddingTop: pillPadY,
    paddingBottom: pillPadY,
  };
  const layoutGapSm = Math.min(12 * scale, boxH * 0.032);
  const layoutGapMd = Math.min(18 * scale, boxH * 0.044);
  /**
   * 표준 2열: 왼쪽 아이콘↔기온, 오른쪽 시계·날짜↔지역·체감 등
   */
  const iconToTempGap = Math.min(12 * scale, boxH * 0.028);
  const gridGapX = Math.min(11 * scale, boxW * 0.026);
  const gridGapY = Math.min(13 * scale, boxH * 0.034);
  /** 표준 2열: 위·아래 동일 픽셀 패딩(퍼센트 불일치·하단 공백 완화) */
  const weatherContentPadX = Math.min(16 * scale, boxW * 0.048);
  /** 위·아래만 타이트하게(내부 글자·아이콘 배율은 그대로) */
  const weatherContentPadY = Math.min(6 * scale, boxH * 0.026);
  const customTextColor = parseBookWidgetTextColor(el.weatherTextColor);
  const useCustomText = Boolean(customTextColor);
  const snowLike = !useCustomText && kind === "snow" && variant !== "air-only";
  const textMain = useCustomText
    ? ""
    : snowLike
      ? "text-slate-800"
      : "text-white";
  const textMuted = useCustomText
    ? "opacity-90"
    : snowLike
      ? "text-slate-700/85"
      : "text-white/85";
  const textFaint = useCustomText
    ? "opacity-80"
    : snowLike
      ? "text-slate-600/90"
      : "text-white/75";
  const iconTone = useCustomText
    ? "text-current"
    : snowLike
      ? "text-slate-800"
      : "text-white";
  const tempAccent = useCustomText
    ? ""
    : snowLike
      ? "text-slate-900"
      : "text-white";

  const showTimeCol = disp.clock || disp.date;
  const hasAir = disp.pm25 || disp.pm10 || disp.aqi;

  /** 2열일 때 왼쪽이 비면(예: 습도만+시계) 빈 칸 대신 세로 스택 레이아웃 사용 */
  const leftHasPrimary =
    variant === "split-air"
      ? Boolean(disp.icon || disp.description || disp.temp || hasAir)
      : variant === "standard"
        ? Boolean(disp.icon || disp.description || disp.temp)
        : true;
  const useWeatherTimeColumns =
    (variant === "standard" || variant === "split-air") &&
    showTimeCol &&
    (variant === "split-air" || leftHasPrimary);

  const ringAccent =
    variant === "split-air"
      ? "ring-[1.5px] ring-emerald-300/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
      : "ring-1 ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]";

  const customBg = parseBookWeatherBackground(el.weatherBackground);
  const contentTextStyle =
    useCustomText && customTextColor
      ? ({ color: customTextColor } as const)
      : undefined;
  const backdropChrome = customBg
    ? bookWidgetBackdropChromeStyle(customBg)
    : null;
  const brPx = Math.max(0, resolveBookElementBorderRadius(el) * scale);
  const ow = resolveBookElementOutlineWidth(el);
  const oc = resolveBookElementOutlineColor(el);
  const outlineRing =
    mode === "edit" && ow > 0
      ? `0 0 0 ${Math.max(0.5, ow * scale)}px ${oc}`
      : "";
  const bgShadow = !customBg
    ? "0 20px 50px -12px rgba(0,0,0,0.4), 0 8px 24px -8px rgba(0,0,0,0.25)"
    : customBg && backdropChrome && backdropChrome.boxShadow !== "none"
      ? backdropChrome.boxShadow
      : "";
  const mergedShadow = [bgShadow, outlineRing].filter(Boolean).join(", ");

  const pillClass = cn(
    "inline-flex max-w-full items-center rounded-full border px-3 py-1.5 font-medium leading-tight",
    useCustomText
      ? "border-current/20 bg-current/5"
      : snowLike
        ? "border-slate-600/25 bg-slate-900/6"
        : "border-white/25 bg-white/12 backdrop-blur-[2px]",
  );

  const renderAirBlock = (
    payload: SeoulWeatherPayload,
    opts: { compact?: boolean },
  ) => (
    <div
      className="flex w-full min-w-0 flex-col"
      style={{ gap: opts.compact ? layoutGapSm : layoutGapMd }}
    >
      {disp.pm10 || disp.pm25 ? (
        <div
          className="flex flex-wrap"
          style={{ gap: layoutGapSm, fontSize: airTextSize * 0.98 }}
        >
          {disp.pm10 ? (
            <span
              className={cn(pillClass, "font-semibold")}
              style={pillPadStyle}
            >
              <span className={cn(textFaint, "opacity-85")}>PM10</span>
              <span className={cn("ms-1.5 tabular-nums", textMuted)}>
                {formatPmShort(payload.pm10)}
              </span>
            </span>
          ) : null}
          {disp.pm25 ? (
            <span
              className={cn(pillClass, "font-semibold")}
              style={pillPadStyle}
            >
              <span className={cn(textFaint, "opacity-85")}>PM2.5</span>
              <span className={cn("ms-1.5 tabular-nums", textMuted)}>
                {formatPmShort(payload.pm25)}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
      {disp.aqi ? (
        <div
          className={cn("font-semibold leading-snug", textMuted)}
          style={{ fontSize: airTextSize * 1.05 }}
        >
          대기 {payload.aqiLabel ?? "—"}
          {payload.aqiLevel != null ? ` (${payload.aqiLevel}/5)` : ""}
        </div>
      ) : null}
    </div>
  );

  const renderSecondaryWeather = (payload: SeoulWeatherPayload) => {
    const chips: { key: string; node: ReactNode }[] = [];
    if (disp.feelsLike) {
      chips.push({
        key: "feel",
        node: (
          <>
            <span className={cn(textFaint, "opacity-75")}>체감</span>
            <span className={cn("ms-0.5 tabular-nums", textMuted)}>
              {Math.round(payload.feelsLikeC)}°
            </span>
          </>
        ),
      });
    }
    if (disp.humidity) {
      chips.push({
        key: "hum",
        node: (
          <>
            <span className={cn(textFaint, "opacity-75")}>습도</span>
            <span className={cn("ms-0.5 tabular-nums", textMuted)}>
              {Math.round(payload.humidity)}%
            </span>
          </>
        ),
      });
    }
    if (disp.wind) {
      chips.push({
        key: "wind",
        node: (
          <>
            <span className={cn(textFaint, "opacity-75")}>바람</span>
            <span className={cn("ms-0.5 tabular-nums", textMuted)}>
              {payload.windMps.toFixed(1)}m/s
            </span>
          </>
        ),
      });
    }
    if (chips.length === 0) return null;
    return (
      <div
        className="flex flex-wrap"
        style={{
          gap: layoutGapSm,
          fontSize: Math.max(airTextSize * 0.92, bodySize * 0.95),
        }}
      >
        {chips.map(({ key, node }) => (
          <span key={key} className={pillClass} style={pillPadStyle}>
            {node}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden",
        !customBg && mode === "edit" && ringAccent,
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
          : {}),
        boxShadow: mergedShadow || undefined,
      }}
    >
      {isPending ? (
        <div
          className={cn(
            "flex h-full min-h-0 items-center justify-center text-white/95",
            !customBg &&
              "bg-linear-to-br from-slate-600 via-slate-800 to-slate-950",
            customBg && "bg-transparent",
          )}
          style={{
            gap: chromePad * 0.85,
            paddingLeft: chromePad,
            paddingRight: chromePad,
          }}
        >
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm",
            )}
            style={{ padding: chromePad }}
          >
            <Loader2
              className="animate-spin opacity-95"
              style={{ width: condSize * 1.05, height: condSize * 1.05 }}
              aria-hidden
            />
          </div>
          <span
            className="font-medium tracking-tight"
            style={{ fontSize: bodySize }}
          >
            불러오는 중…
          </span>
        </div>
      ) : isError ? (
        <div
          className={cn(
            "flex h-full min-h-0 flex-col items-center justify-center gap-2 px-3 text-center",
            !customBg &&
              "bg-linear-to-br from-amber-950/98 via-orange-950/95 to-slate-950 text-amber-50",
            customBg && "bg-transparent text-amber-100",
          )}
          style={{ fontSize: bodySize }}
        >
          <div
            className="flex shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/20 backdrop-blur-sm"
            style={{
              padding: chromePad,
              minWidth: Math.max(36 * scale, condSize * 2.2),
              minHeight: Math.max(36 * scale, condSize * 2.2),
            }}
          >
            <CloudOff
              className="opacity-95"
              style={{ width: condSize * 1.35, height: condSize * 1.35 }}
              aria-hidden
            />
          </div>
          <span className="max-w-[95%] text-[0.8em] font-medium leading-snug opacity-95">
            {errMsg}
          </span>
        </div>
      ) : data ? (
        <div
          className={cn(
            "relative h-full min-h-0 w-full overflow-hidden",
            !useCustomText && "text-white",
          )}
          style={contentTextStyle}
        >
          {!customBg && variant === "air-only" ? (
            <AirQualityBackdrop aqiLevel={data.aqiLevel} />
          ) : !customBg ? (
            <CardBackdrop kind={kind} />
          ) : null}

          {variant === "air-only" ? (
            <div
              className={cn(
                "relative z-1 flex h-full min-h-0 flex-col justify-between px-[6%] py-[7%]",
                !useCustomText && "text-white",
              )}
            >
              <div className="min-w-0">
                <div
                  className={cn(
                    "font-semibold tracking-tight",
                    useCustomText
                      ? "opacity-95"
                      : "text-white/95 drop-shadow-sm",
                  )}
                  style={{ fontSize: airTextSize * 1.08 }}
                >
                  {data.locationLabel}
                </div>
                <div
                  className={cn(
                    "mt-1 font-semibold uppercase tracking-[0.16em]",
                    useCustomText ? "opacity-55" : "text-white/55",
                  )}
                  style={{ fontSize: airTextSize * 0.78 }}
                >
                  대기질
                </div>
              </div>
              <div
                className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden"
                style={{ gap: layoutGapSm }}
              >
                {disp.aqi ? (
                  <>
                    <div
                      className={cn(
                        "pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-2xl",
                        useCustomText ? "bg-current" : "bg-emerald-300",
                      )}
                      style={{
                        width: Math.min(boxW * 0.9, boxH * 0.38),
                        height: Math.min(boxW * 0.9, boxH * 0.38),
                      }}
                      aria-hidden
                    />
                    <div
                      className={cn(
                        "relative font-bold tabular-nums leading-none",
                        useCustomText ? "" : aqiAccentClass(data.aqiLevel),
                      )}
                      style={{ fontSize: aqiHuge }}
                    >
                      {data.aqiLabel ?? "—"}
                      {data.aqiLevel != null ? (
                        <span
                          className={cn(
                            "text-[0.44em] font-semibold tracking-normal",
                            useCustomText ? "opacity-70" : "text-white/70",
                          )}
                        >
                          {" "}
                          · {data.aqiLevel}/5
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : null}
                {renderAirBlock(data, { compact: true })}
              </div>
            </div>
          ) : variant === "time-only" ? (
            <div
              className={cn(
                "relative z-1 flex h-full min-h-0 flex-col items-center justify-center overflow-hidden px-[6%] py-[6%] text-center",
                textMain,
              )}
              style={{ gap: layoutGapMd }}
            >
              {disp.clock ? (
                <div
                  className={cn(
                    "font-bold tabular-nums tracking-tight",
                    !useCustomText && !snowLike && "drop-shadow-md",
                  )}
                  style={{ fontSize: clockSize, lineHeight: 1 }}
                >
                  {timeStr}
                </div>
              ) : null}
              {disp.date ? (
                <div
                  className={cn(
                    "max-w-full font-medium leading-snug",
                    textFaint,
                  )}
                  style={{ fontSize: bodySize * 0.92 }}
                >
                  {dateStr}
                </div>
              ) : null}
              <div
                className={cn(
                  "mt-0.5 font-semibold uppercase tracking-[0.14em]",
                  textMuted,
                )}
                style={{ fontSize: bodySize * 0.88 }}
              >
                {data.locationLabel}
              </div>
            </div>
          ) : variant === "minimal" ? (
            <div
              className={cn(
                "relative z-1 flex h-full min-h-0 flex-col items-center justify-center overflow-hidden px-[6%] py-[6%]",
                textMain,
              )}
              style={{ gap: layoutGapMd }}
            >
              {disp.icon ? (
                <div
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-2xl border backdrop-blur-md",
                    useCustomText
                      ? "border-current/20 bg-current/8"
                      : snowLike
                        ? "border-slate-700/20 bg-white/55"
                        : "border-white/25 bg-white/15",
                  )}
                  style={{ padding: chromePad }}
                >
                  <LineIcon
                    className={cn("shrink-0 stroke-[2.1]", iconTone)}
                    style={{ width: condSize * 1.45, height: condSize * 1.45 }}
                    aria-hidden
                  />
                </div>
              ) : null}
              {disp.description ? (
                <span
                  className={cn(
                    "text-center font-medium capitalize leading-snug",
                    textMuted,
                  )}
                  style={{ fontSize: bodySize }}
                >
                  {data.description || "—"}
                </span>
              ) : null}
              {disp.temp ? (
                <div className="flex items-end gap-0.5">
                  <span
                    className={cn(
                      "tabular-nums font-bold tracking-tighter",
                      tempAccent,
                      !useCustomText &&
                        !snowLike &&
                        "drop-shadow-[0_2px_12px_rgba(0,0,0,0.2)]",
                    )}
                    style={{ fontSize: tempSizeMinimal, lineHeight: 0.92 }}
                  >
                    {Math.round(data.tempC)}
                  </span>
                  <span
                    className={cn(
                      "pb-[0.1em] font-semibold opacity-90",
                      textMuted,
                    )}
                    style={{ fontSize: tempSizeMinimal * 0.3 }}
                  >
                    °C
                  </span>
                </div>
              ) : null}
              {renderSecondaryWeather(data)}
              <div
                className={cn(
                  "mt-auto text-center text-[0.72em] font-semibold uppercase tracking-[0.12em]",
                  textFaint,
                )}
                style={{ fontSize: bodySize * 0.85 }}
              >
                {data.locationLabel}
              </div>
            </div>
          ) : variant === "standard" && showTimeCol && !leftHasPrimary ? (
            <div
              className={cn(
                "relative z-1 flex h-full min-h-0 min-w-0 overflow-hidden px-[5%] py-[5%]",
                textMain,
              )}
              style={{ gap: layoutGapMd }}
            >
              <div
                className="flex shrink-0 flex-col items-center sm:items-start"
                style={{ gap: layoutGapSm }}
              >
                {disp.clock ? (
                  <div
                    className={cn(
                      "font-bold tabular-nums tracking-tight",
                      !useCustomText && !snowLike && "drop-shadow-md",
                    )}
                    style={{ fontSize: clockSize, lineHeight: 1 }}
                  >
                    {timeStr}
                  </div>
                ) : null}
                {disp.date ? (
                  <div
                    className={cn(
                      "font-medium leading-snug opacity-90",
                      textFaint,
                    )}
                    style={{ fontSize: bodySize * 0.88 }}
                  >
                    {dateStr}
                  </div>
                ) : null}
              </div>
              <div
                className="flex min-h-0 min-w-0 flex-col"
                style={{ gap: layoutGapMd }}
              >
                <div
                  className={cn(
                    "font-semibold uppercase tracking-[0.12em]",
                    textMain,
                  )}
                  style={{ fontSize: bodySize }}
                >
                  {data.locationLabel}
                </div>
                {hasAir ? renderAirBlock(data, {}) : null}
                {renderSecondaryWeather(data)}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "relative z-1 flex h-full min-h-0 w-full items-center justify-center overflow-hidden",
                textMain,
              )}
              style={{
                paddingLeft: weatherContentPadX,
                paddingRight: weatherContentPadX,
                paddingTop: weatherContentPadY,
                paddingBottom: weatherContentPadY,
              }}
            >
              <div
                className={cn(
                  "grid max-h-full min-h-0 w-full min-w-0",
                  useWeatherTimeColumns
                    ? "grid-cols-[minmax(0,1.12fr)_minmax(0,0.98fr)]"
                    : "grid-cols-1",
                )}
                style={{
                  columnGap: gridGapX,
                  rowGap: gridGapY,
                  alignItems: "start",
                }}
              >
                <div
                  className="flex min-h-0 min-w-0 flex-col justify-start"
                  style={{ gap: iconToTempGap }}
                >
                  {disp.description || disp.icon ? (
                    <div
                      className="flex min-w-0 items-center"
                      style={{ gap: layoutGapSm }}
                    >
                      {disp.icon ? (
                        <div
                          className={cn(
                            "flex shrink-0 items-center justify-center rounded-xl border backdrop-blur-md",
                            useCustomText
                              ? "border-current/20 bg-current/8"
                              : snowLike
                                ? "border-slate-600/25 bg-white/50"
                                : "border-white/25 bg-white/12",
                          )}
                          style={{ padding: iconShellPad }}
                        >
                          <LineIcon
                            className={cn("shrink-0 stroke-[2.1]", iconTone)}
                            style={{
                              width: condSize * 1.25,
                              height: condSize * 1.25,
                            }}
                            aria-hidden
                          />
                        </div>
                      ) : null}
                      {disp.description ? (
                        <span
                          className={cn(
                            "line-clamp-3 min-w-0 break-words font-medium capitalize leading-tight",
                            textMuted,
                            !useCustomText && !snowLike && "drop-shadow-sm",
                          )}
                          style={{ fontSize: bodySize * 1.02 }}
                          title={data.description}
                        >
                          {data.description || "—"}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div
                    className="flex min-h-0 flex-col"
                    style={{ gap: layoutGapSm }}
                  >
                    {disp.temp ? (
                      <div className="flex items-end gap-0.5">
                        <span
                          className={cn(
                            "tabular-nums font-bold tracking-tighter",
                            tempAccent,
                            !useCustomText &&
                              !snowLike &&
                              "drop-shadow-[0_2px_14px_rgba(0,0,0,0.22)]",
                          )}
                          style={{
                            fontSize:
                              variant === "split-air"
                                ? tempSize * 0.9
                                : tempSize,
                            lineHeight: 0.92,
                          }}
                        >
                          {Math.round(data.tempC)}
                        </span>
                        <span
                          className={cn(
                            "pb-[0.1em] font-semibold opacity-90",
                            textMuted,
                          )}
                          style={{ fontSize: tempSize * 0.36 }}
                        >
                          °C
                        </span>
                      </div>
                    ) : null}
                    {variant === "split-air" && hasAir ? (
                      <div className="min-h-0">
                        {renderAirBlock(data, { compact: true })}
                      </div>
                    ) : null}
                  </div>
                </div>

                {useWeatherTimeColumns ? (
                  <div
                    className={cn(
                      "flex min-h-0 min-w-0 flex-col items-end justify-start overflow-hidden border-l text-end",
                      useCustomText
                        ? "border-current/18"
                        : snowLike
                          ? "border-slate-600/30"
                          : "border-white/22",
                    )}
                    style={{
                      paddingLeft: Math.min(11 * scale, boxW * 0.028),
                      gap: iconToTempGap,
                    }}
                  >
                    <div
                      className="flex min-h-0 shrink-0 flex-col"
                      style={{ gap: Math.max(3 * scale, layoutGapSm * 0.65) }}
                    >
                      {disp.clock ? (
                        <div
                          className={cn(
                            "font-bold tabular-nums tracking-tight",
                            textMain,
                            !useCustomText && !snowLike && "drop-shadow-md",
                          )}
                          style={{ fontSize: clockSize, lineHeight: 1 }}
                        >
                          {timeStr}
                        </div>
                      ) : null}
                      {disp.date ? (
                        <div
                          className={cn(
                            "font-medium leading-snug opacity-90",
                            textFaint,
                          )}
                          style={{ fontSize: bodySize * 0.88 }}
                        >
                          {dateStr}
                        </div>
                      ) : null}
                    </div>
                    <div
                      className="flex min-h-0 w-full min-w-0 flex-col"
                      style={{ gap: layoutGapSm }}
                    >
                      <div
                        className={cn(
                          "text-[0.72em] font-semibold uppercase tracking-[0.14em] opacity-90",
                          textMain,
                        )}
                        style={{ fontSize: bodySize }}
                      >
                        {data.locationLabel}
                      </div>
                      {variant === "standard" && hasAir
                        ? renderAirBlock(data, {})
                        : null}
                      {variant === "standard" || variant === "split-air"
                        ? renderSecondaryWeather(data)
                        : null}
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "col-span-full flex min-h-0 flex-col border-t",
                      useCustomText ? "border-current/20" : "border-white/18",
                    )}
                    style={{
                      gap: layoutGapSm,
                      paddingTop: Math.min(14 * scale, boxH * 0.036),
                    }}
                  >
                    <div
                      className={cn(
                        "text-[0.72em] font-semibold uppercase tracking-[0.12em]",
                        textMain,
                      )}
                      style={{ fontSize: bodySize }}
                    >
                      {data.locationLabel}
                    </div>
                    {hasAir && variant !== "split-air"
                      ? renderAirBlock(data, {})
                      : null}
                    {renderSecondaryWeather(data)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
