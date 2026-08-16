import { ChartColumn } from "lucide-react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import {
  type BookCanvasElement,
  type BookChartDatum,
  type BookChartType,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  DEFAULT_BOOK_CHART_COLOR,
  DEFAULT_BOOK_CHART_DATA,
  DEFAULT_BOOK_CHART_TYPE,
  parseBookChartData,
  parseBookChartType,
  parseBookOutlineColor,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
} from "@/lib/book-canvas";
import { cn } from "@/lib/utils";

type Props = {
  el: Extract<BookCanvasElement, { type: "chart" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

/** 파이 슬라이스·다계열 대비 팔레트(0번은 강조색으로 대체) */
const CHART_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#db2777",
  "#0891b2",
  "#7c3aed",
  "#dc2626",
  "#65a30d",
  "#0d9488",
  "#c026d3",
];

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** 원점에서 시작하는 파이 슬라이스 path */
function pieSlicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function ChartSvg({
  type,
  data,
  color,
  fw,
  fh,
}: {
  type: BookChartType;
  data: BookChartDatum[];
  color: string;
  fw: number;
  fh: number;
}) {
  const padX = Math.max(10, fw * 0.06);
  const padTop = Math.max(10, fh * 0.08);
  const padBottom = Math.max(18, fh * 0.14);
  const plotW = Math.max(1, fw - padX * 2);
  const plotH = Math.max(1, fh - padTop - padBottom);
  const labelSize = Math.max(7, Math.min(fh * 0.06, plotW / data.length / 3));
  const maxV = Math.max(1, ...data.map((d) => Math.abs(d.value)));

  if (type === "pie") {
    const total = data.reduce((s, d) => s + Math.abs(d.value), 0) || 1;
    const cx = fw / 2;
    const r = Math.max(4, Math.min(plotW, plotH) / 2);
    const cy = padTop + r;
    // 누적 각도를 렌더 전에 미리 계산(렌더 중 변수 변경 금지)
    const slices = data.map((d, i) => {
      const before = data
        .slice(0, i)
        .reduce((s, x) => s + Math.abs(x.value), 0);
      return {
        start: (before / total) * 360,
        end: ((before + Math.abs(d.value)) / total) * 360,
      };
    });
    return (
      <svg
        width={fw}
        height={fh}
        viewBox={`0 0 ${fw} ${fh}`}
        role="img"
        aria-label="파이 차트"
      >
        {data.map((d, i) => {
          const fill =
            i === 0 ? color : CHART_PALETTE[i % CHART_PALETTE.length];
          return (
            <path
              key={i}
              d={pieSlicePath(cx, cy, r, slices[i]!.start, slices[i]!.end)}
              fill={fill}
              stroke="#ffffff"
              strokeWidth={Math.max(0.5, fw * 0.004)}
            />
          );
        })}
        {/* 하단 범례 */}
        {data.map((d, i) => {
          const lx = padX + (i % 3) * (plotW / 3);
          const ly = fh - padBottom + labelSize + Math.floor(i / 3) * labelSize;
          const fill =
            i === 0 ? color : CHART_PALETTE[i % CHART_PALETTE.length];
          return (
            <g key={`lg-${i}`}>
              <rect
                x={lx}
                y={ly - labelSize * 0.8}
                width={labelSize * 0.8}
                height={labelSize * 0.8}
                fill={fill}
                rx={1}
              />
              <text
                x={lx + labelSize}
                y={ly}
                fontSize={labelSize}
                fill="#475569"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const bandW = plotW / data.length;

  return (
    <svg
      width={fw}
      height={fh}
      viewBox={`0 0 ${fw} ${fh}`}
      role="img"
      aria-label={type === "bar" ? "막대 차트" : "선 차트"}
    >
      {/* 기준선 */}
      <line
        x1={padX}
        y1={padTop + plotH}
        x2={padX + plotW}
        y2={padTop + plotH}
        stroke="#e2e8f0"
        strokeWidth={Math.max(0.5, fw * 0.003)}
      />
      {type === "bar"
        ? data.map((d, i) => {
            const bh = (Math.abs(d.value) / maxV) * plotH;
            const bw = bandW * 0.6;
            const bx = padX + i * bandW + (bandW - bw) / 2;
            const by = padTop + plotH - bh;
            return (
              <rect
                key={i}
                x={bx}
                y={by}
                width={bw}
                height={Math.max(0, bh)}
                fill={color}
                rx={Math.max(1, bw * 0.08)}
              />
            );
          })
        : (() => {
            const pts = data.map((d, i) => {
              const px = data.length > 1 ? padX + i * stepX : padX + plotW / 2;
              const py = padTop + plotH - (Math.abs(d.value) / maxV) * plotH;
              return { px, py };
            });
            const poly = pts.map((p) => `${p.px},${p.py}`).join(" ");
            return (
              <g>
                <polyline
                  points={poly}
                  fill="none"
                  stroke={color}
                  strokeWidth={Math.max(1, fw * 0.006)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.px}
                    cy={p.py}
                    r={Math.max(1.5, fw * 0.008)}
                    fill={color}
                  />
                ))}
              </g>
            );
          })()}
      {/* x 라벨 */}
      {data.map((d, i) => {
        const lx =
          type === "bar"
            ? padX + i * bandW + bandW / 2
            : data.length > 1
              ? padX + i * stepX
              : padX + plotW / 2;
        return (
          <text
            key={`x-${i}`}
            x={lx}
            y={padTop + plotH + labelSize + 2}
            fontSize={labelSize}
            fill="#64748b"
            textAnchor="middle"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

export function BookChartWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
}: Props) {
  const data = parseBookChartData(el.chartData) ?? DEFAULT_BOOK_CHART_DATA;
  const type = parseBookChartType(el.chartType) ?? DEFAULT_BOOK_CHART_TYPE;
  const color =
    parseBookOutlineColor(el.chartColor) ?? DEFAULT_BOOK_CHART_COLOR;
  const hasData = data.length > 0;

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

  const brPx = Math.max(0, resolveBookElementBorderRadius(el) * scale);
  const ow = resolveBookElementOutlineWidth(el);
  const oc = resolveBookElementOutlineColor(el);
  const outlineRing =
    mode === "edit" && ow > 0
      ? `0 0 0 ${Math.max(0.5, ow * scale)}px ${oc}`
      : "";

  const hintPx = Math.max(10 * scale, fh * scale * 0.05);
  const hintIconPx = Math.max(16 * scale, fh * scale * 0.12);

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden bg-white",
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
        boxShadow: outlineRing || "0 12px 32px -8px rgba(0,0,0,0.28)",
      }}
    >
      {hasData ? (
        <div
          /* 논리 픽셀 크기로 렌더 후 확대/축소 */
          className="absolute left-0 top-0 bg-white"
          style={{
            width: fw,
            height: fh,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <ChartSvg type={type} data={data} color={color} fw={fw} fh={fh} />
        </div>
      ) : (
        <div
          className="flex size-full flex-col items-center justify-center bg-slate-100 px-3 text-center text-slate-500"
          style={{ gap: Math.max(8, scale * 6), fontSize: hintPx }}
        >
          <ChartColumn
            aria-hidden
            style={{ width: hintIconPx, height: hintIconPx }}
            className="opacity-70"
          />
          <p>속성 창에서 데이터를 추가하세요.</p>
        </div>
      )}
    </div>
  );
}
