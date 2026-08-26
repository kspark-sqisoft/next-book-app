// 광고 소재·하우스 미디어 썸네일 — 고해상 원본(수천만 화소 이미지·4K 영상)을
// 목록에 그대로 그리면 스크롤마다 래스터 비용이 커져 화면이 끊긴다.
// 한 번만 축소 캡처한 작은 비트맵(blob URL)을 <img>로 그려 페인트를 가볍게 한다.
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** src+크기별 캡처 결과 공유(같은 소재가 여러 곳에 보여도 1회만 디코딩) */
const thumbCache = new Map<string, Promise<string | null>>();

async function downscaleImageUrl(
  src: string,
  maxW: number,
): Promise<string | null> {
  try {
    const res = await fetch(src, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    // 디코더 수준 축소 — 중간에 원본 크기 비트맵을 만들지 않는다
    const bmp = await createImageBitmap(blob, {
      resizeWidth: maxW,
      resizeQuality: "high",
    }).catch(() => createImageBitmap(blob));
    if (bmp.width === 0 || bmp.height === 0) return null;
    const scale = Math.min(1, maxW / bmp.width);
    const cw = Math.max(1, Math.round(bmp.width * scale));
    const ch = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, cw, ch);
    bmp.close();
    const out = await new Promise<Blob | null>((r) =>
      canvas.toBlob((b) => r(b), "image/jpeg", 0.82),
    );
    return out ? URL.createObjectURL(out) : null;
  } catch {
    return null;
  }
}

async function captureVideoFrameUrl(
  src: string,
  maxW: number,
): Promise<string | null> {
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = src;
    await new Promise<void>((resolve, reject) => {
      const to = window.setTimeout(() => reject(new Error("timeout")), 10_000);
      video.onloadedmetadata = () => {
        clearTimeout(to);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(to);
        reject(new Error("metadata"));
      };
    });
    const dur = video.duration;
    video.currentTime =
      Number.isFinite(dur) && dur > 0 ? Math.min(0.25, dur * 0.1) : 0;
    await new Promise<void>((resolve, reject) => {
      const to = window.setTimeout(() => reject(new Error("timeout")), 10_000);
      video.onseeked = () => {
        clearTimeout(to);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(to);
        reject(new Error("seek"));
      };
    });
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, maxW / w);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // 외부 오리진 영상은 canvas가 오염되어 toBlob이 던질 수 있음 → 폴백
    const out = await new Promise<Blob | null>((r) => {
      try {
        canvas.toBlob((b) => r(b), "image/jpeg", 0.82);
      } catch {
        r(null);
      }
    });
    video.removeAttribute("src");
    video.load();
    return out ? URL.createObjectURL(out) : null;
  } catch {
    return null;
  }
}

function getThumb(
  kind: "image" | "video",
  src: string,
  maxW: number,
): Promise<string | null> {
  const key = `${kind}:${maxW}:${src}`;
  let p = thumbCache.get(key);
  if (!p) {
    p =
      kind === "image"
        ? downscaleImageUrl(src, maxW)
        : captureVideoFrameUrl(src, maxW);
    thumbCache.set(key, p);
  }
  return p;
}

type Props = {
  kind: "image" | "video";
  /** 실제 로드 가능한 URL(publicAssetUrl 적용 후) */
  src: string;
  className?: string;
  /** 캡처 최대 가로 픽셀 — 표시 폭의 2~3배면 충분 */
  maxWidth?: number;
};

export function AdMediaThumb({ kind, src, className, maxWidth = 192 }: Props) {
  /** undefined = 캡처 중, null = 실패(원본 폴백). src가 바뀌면 key로 리마운트해 초기화. */
  const [thumb, setThumb] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getThumb(kind, src, maxWidth).then((u) => {
      if (alive) setThumb(u);
    });
    return () => {
      alive = false;
    };
  }, [kind, src, maxWidth]);

  if (thumb) {
    return (
      <img
        alt=""
        src={thumb}
        draggable={false}
        decoding="async"
        className={className}
      />
    );
  }
  if (thumb === null) {
    // 축소 실패(외부 URL·코덱 제한 등) — 기존 방식 그대로 폴백
    return kind === "image" ? (
      <img
        alt=""
        src={src}
        draggable={false}
        loading="lazy"
        decoding="async"
        className={className}
      />
    ) : (
      <video
        className={className}
        src={src}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return <span className={cn("block bg-black/30", className)} aria-hidden />;
}
