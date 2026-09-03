import { SquarePlay } from "lucide-react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  parseBookYoutubeVideoId,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
} from "@/features/book/book-canvas";
import { cn } from "@/lib/utils";

type Props = {
  el: Extract<BookCanvasElement, { type: "youtube" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

export function BookYoutubeWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
}: Props) {
  const videoId = parseBookYoutubeVideoId(el.youtubeUrl);

  const autoplay = el.youtubeAutoplay !== false;
  const mute = el.youtubeMute !== false;
  const loop = el.youtubeLoop !== false;
  const controls = el.youtubeControls === true;

  let src: string | null = null;
  if (videoId) {
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      mute: mute ? "1" : "0",
      controls: controls ? "1" : "0",
      loop: loop ? "1" : "0",
      playsinline: "1",
      rel: "0",
    });
    // loop는 playlist에 같은 id를 넣어야 동작(유튜브 embed 규칙)
    if (loop) params.set("playlist", videoId);
    src = `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  }

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

  const hintPx = Math.max(10 * scale, fh * scale * 0.032);
  const hintIconPx = Math.max(16 * scale, fh * scale * 0.09);

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden bg-black",
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
        boxShadow: outlineRing || "0 12px 32px -8px rgba(0,0,0,0.35)",
      }}
    >
      {src ? (
        <iframe
          /* 주소·옵션이 바뀌면 강제 재로드 */
          key={`${el.id}:${src}`}
          title="유튜브 위젯"
          src={src}
          className={cn(
            "absolute left-0 top-0 border-0 bg-black",
            mode === "view" ? "pointer-events-auto" : "pointer-events-none",
          )}
          style={{
            width: fw,
            height: fh,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <div
          className="flex size-full flex-col items-center justify-center bg-zinc-900 px-3 text-center text-zinc-400"
          style={{ gap: Math.max(8, scale * 6), fontSize: hintPx }}
        >
          <SquarePlay
            aria-hidden
            style={{ width: hintIconPx, height: hintIconPx }}
            className="opacity-80"
          />
          <p>
            속성 창에 유튜브 주소(watch·youtu.be·shorts)나 동영상 id를
            입력하세요.
          </p>
        </div>
      )}
    </div>
  );
}
