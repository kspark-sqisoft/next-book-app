"use client";

// 광고 위젯(구좌) 오버레이 — 편집 모드는 구좌 플레이스홀더 카드,
// 보기 모드는 활성 캠페인 소재(이미지/영상)를 슬롯 길이 공통 클록으로 순환 재생.
// 소재가 바뀔 때마다 재생 로그(Proof-of-Play)를 기록한다(시뮬레이션).
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  resolveBookAdSlotFill,
  resolveBookAdSlotSec,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
} from "@/features/book/book-canvas";
import {
  buildCretaAdRotation,
  cretaAdRotationIndex,
} from "@/features/creta/creta-ad-rotation";
import {
  fetchCretaAdActiveCreatives,
  fetchCretaAdSetting,
  logCretaAdPlay,
} from "@/features/creta/creta-ads-api";
import { publicAssetUrl } from "@/lib/api";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type Props = {
  el: Extract<BookCanvasElement, { type: "adSlot" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
  /** 재생 로그에 남길 북 id(편집·미리보기에서 전달, 없으면 null) */
  bookId?: number | null;
  /**
   * 이 화면이 흉내내는 디바이스 id — 프레젠테이션 `?device=` 에서 온다.
   * 있으면 그 화면을 대상으로 하는 캠페인만 순환하고, 노출 로그에도 화면이 남는다.
   */
  adDeviceId?: number | null;
};

export function BookAdSlotWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
  bookId,
  adDeviceId,
}: Props) {
  const slotSec = resolveBookAdSlotSec(el);
  const fill = resolveBookAdSlotFill(el);

  const { data: creatives } = useQuery({
    queryKey: cretaKeys.adActiveCreatives(adDeviceId),
    queryFn: () => fetchCretaAdActiveCreatives(adDeviceId),
    // 편집 모드에선 개수 표시용으로만 쓰므로 갱신을 느리게
    staleTime: 30_000,
    refetchInterval: mode === "view" ? 60_000 : false,
  });

  const rotation = useMemo(
    () => buildCretaAdRotation(creatives ?? []),
    [creatives],
  );

  /** 전역 설정 — 하우스 광고 소재(빈 구좌 채움) */
  const { data: adSetting } = useQuery({
    queryKey: cretaKeys.adSetting(),
    queryFn: fetchCretaAdSetting,
    staleTime: 60_000,
  });

  /** 슬롯 길이 공통 클록 — 같은 구좌를 여러 화면이 봐도 같은 소재가 나온다 */
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (mode !== "view" || rotation.length === 0) return;
    const compute = () => cretaAdRotationIndex(rotation.length, slotSec);
    queueMicrotask(() => setIndex(compute()));
    const t = window.setInterval(() => setIndex(compute()), 1000);
    return () => window.clearInterval(t);
  }, [mode, rotation.length, slotSec]);

  const current =
    rotation.length > 0 ? rotation[Math.min(index, rotation.length - 1)] : null;

  /** 소재가 바뀔 때 1회 재생 기록 — 같은 epoch 중복 방지 */
  const loggedKeyRef = useRef("");
  useEffect(() => {
    if (mode !== "view" || !current) return;
    const key = `${current.id}:${index}`;
    if (loggedKeyRef.current === key) return;
    loggedKeyRef.current = key;
    void logCretaAdPlay({
      creativeId: current.id,
      bookId: bookId ?? null,
      slotElementId: el.id,
      durationSec: slotSec,
      deviceId: adDeviceId ?? null,
    });
  }, [mode, current, index, el.id, bookId, slotSec, adDeviceId]);

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
  const origin = bookElementOverlayTopLeftFromPivot(pivot, w, h);
  const fx = liveFrame?.x ?? origin.x;
  const fy = liveFrame?.y ?? origin.y;
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

  const emptyAndHidden = mode === "view" && !current && fill === "hide";
  /**
   * 보기 모드에서 보여 줄 것이 아직 없으면 바탕을 칠하지 않는다. 소재 목록·설정을 받고
   * 이미지를 디코드하기까지 짙은 회색 네모가 먼저 떠서, 커뮤니티 미리보기에서 "회색 →
   * 내용" 으로 튀어 보였다. 그동안은 슬라이드 배경이 그대로 비치는 편이 자연스럽다.
   */
  const hasContent =
    mode === "edit" ||
    current != null ||
    (fill === "house" && adSetting != null);
  /**
   * 소재 이미지는 디코드가 끝난 뒤 나타나게 — 바탕에서 이미지로 부드럽게.
   * "어느 소재가 로드됐는지"를 기억하면 소재가 바뀔 때 되돌리는 이펙트가 필요 없다.
   */
  const [loadedCreativeId, setLoadedCreativeId] = useState<number | null>(null);
  const creativeLoaded = current != null && loadedCreativeId === current.id;

  const src = current ? (publicAssetUrl(current.src) ?? current.src) : "";
  const labelPx = Math.max(9, Math.min(13, fh * scale * 0.045));

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden",
        hasContent && "bg-zinc-900",
        isSelected && mode === "edit" && "ring-2 ring-primary ring-offset-0",
        emptyAndHidden && "invisible",
      )}
      data-book-ad-slot={el.id}
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
      {mode === "edit" ? (
        /* 편집 — 구좌 플레이스홀더(파란 배경 + 흰 글자 + 광고 아이콘) */
        <div className="relative flex size-full flex-col items-center justify-center gap-[0.3em] overflow-hidden bg-blue-600 px-4 text-center">
          <BadgeDollarSign
            className="text-white/90"
            style={{
              width: Math.min(56, Math.max(18, fh * scale * 0.16)),
              height: Math.min(56, Math.max(18, fh * scale * 0.16)),
            }}
            aria-hidden
          />
          <p
            className="max-w-full truncate font-semibold text-white"
            style={{ fontSize: Math.min(30, Math.max(13, fh * scale * 0.085)) }}
          >
            {el.adSlotName?.trim() || "광고 구좌"}
          </p>
          <p
            className="text-blue-100/90"
            style={{ fontSize: Math.min(13, Math.max(9, fh * scale * 0.045)) }}
          >
            {slotSec}초 · 활성 소재 {rotation.length}개 · 재생 시 순환
          </p>
        </div>
      ) : current ? (
        <>
          {current.kind === "image" ? (
            <img
              key={current.id}
              alt=""
              src={src}
              draggable={false}
              className={cn(
                "absolute inset-0 size-full select-none object-cover transition-opacity duration-200",
                creativeLoaded ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => setLoadedCreativeId(current.id)}
            />
          ) : (
            <video
              key={`${current.id}:${index}`}
              className="absolute inset-0 size-full object-cover"
              src={src}
              muted
              playsInline
              autoPlay
              loop
              preload="auto"
              controls={false}
            />
          )}
          {/* 광고 표기(업계 관례) + 광고주 캠페인 이름 */}
          <span
            className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-px font-semibold tracking-wide text-amber-300"
            style={{ fontSize: labelPx }}
          >
            AD
          </span>
          <span
            className="absolute bottom-1.5 right-1.5 max-w-[70%] truncate rounded bg-black/55 px-1.5 py-px text-white/85"
            style={{ fontSize: labelPx }}
          >
            {current.campaignName}
          </span>
        </>
      ) : fill === "house" && adSetting?.houseSrc ? (
        /* 빈 구좌 — 관리자가 지정한 하우스 광고 소재 */
        <>
          {adSetting.houseKind === "video" ? (
            <video
              className="absolute inset-0 size-full object-cover"
              src={publicAssetUrl(adSetting.houseSrc) ?? adSetting.houseSrc}
              muted
              playsInline
              autoPlay
              loop
              preload="auto"
              controls={false}
            />
          ) : (
            <img
              alt=""
              src={publicAssetUrl(adSetting.houseSrc) ?? adSetting.houseSrc}
              draggable={false}
              className="absolute inset-0 size-full select-none object-cover"
            />
          )}
          <span
            className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-px font-semibold tracking-wide text-sky-300"
            style={{ fontSize: labelPx }}
          >
            HOUSE
          </span>
          {adSetting.houseName ? (
            <span
              className="absolute bottom-1.5 right-1.5 max-w-[70%] truncate rounded bg-black/55 px-1.5 py-px text-white/85"
              style={{ fontSize: labelPx }}
            >
              {adSetting.houseName}
            </span>
          ) : null}
        </>
      ) : fill === "house" ? (
        /* 빈 구좌 — 하우스 광고 카드 */
        <div className="flex size-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-3 text-center text-white">
          <p
            className="font-heading font-bold"
            style={{ fontSize: Math.max(13, fh * scale * 0.11) }}
          >
            CRETA
          </p>
          <p style={{ fontSize: Math.max(9, fh * scale * 0.05) }}>
            이 구좌에 광고를 게재해 보세요
          </p>
        </div>
      ) : null}
    </div>
  );
}
