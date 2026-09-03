"use client";

// AI 자막(시뮬레이션) 캡션 — 비디오 위젯·미디어 위젯(동영상 항목) 공용.
// 재생 시간에 따라 언어별 예시 대사를 순환해 표시한다.
import {
  bookSubtitleLangLabel,
  simulatedSubtitleLine,
} from "@/features/book/book-video-subtitles";

export function BookVideoSubtitleCaption({
  lang,
  currentTimeSec,
  bottomPx,
  fontSizePx,
}: {
  lang: string | undefined;
  currentTimeSec: number;
  /** 위젯 하단에서 띄울 간격(px) — 컨트롤 바가 보이면 호출부가 바 높이를 더해 넘긴다 */
  bottomPx: number;
  fontSizePx: number;
}) {
  return (
    <div
      data-book-video-subtitle
      className="pointer-events-none absolute inset-x-0 z-[5] flex flex-col items-center gap-0.5 px-2 text-center transition-[bottom] duration-200"
      style={{ bottom: bottomPx }}
    >
      <span className="rounded bg-black/55 px-1.5 py-px text-[9px] font-medium tracking-wide text-emerald-300">
        AI 자막 · {bookSubtitleLangLabel(lang)}
      </span>
      <span
        className="max-w-full rounded bg-black/65 px-2 py-0.5 leading-snug text-white"
        style={{ fontSize: fontSizePx }}
      >
        {simulatedSubtitleLine(lang, currentTimeSec)}
      </span>
    </div>
  );
}
