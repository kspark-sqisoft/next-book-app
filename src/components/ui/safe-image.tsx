"use client";

import { ImageOff } from "lucide-react";
import { useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { publicAssetUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  /** 빈·깨진 URL일 때 대체 UI. 없으면 아이콘 플레이스홀더( className 동일 적용 ) */
  fallback?: ReactNode;
  /** true면 실패 시 아무것도 렌더하지 않음(아바타 등) */
  hideOnError?: boolean;
  /** 기본 플레이스홀더의 접근성 이름 */
  placeholderLabel?: string;
};

type BodyProps = Omit<SafeImageProps, "src"> & { trimmed: string };

function SafeImageBody({
  trimmed,
  alt = "",
  className,
  fallback,
  hideOnError = false,
  placeholderLabel,
  onError,
  onLoad,
  ...rest
}: BodyProps) {
  const [broken, setBroken] = useState(false);
  const showFallback = !trimmed || broken;

  if (showFallback) {
    if (fallback !== undefined) return <>{fallback}</>;
    if (hideOnError) return null;
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/70 text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={placeholderLabel || alt || "이미지를 불러올 수 없습니다"}
      >
        <ImageOff className="size-7 shrink-0 opacity-40" strokeWidth={1.25} aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={trimmed}
      alt={alt}
      className={className}
      onError={(e) => {
        setBroken(true);
        onError?.(e);
      }}
      onLoad={(e) => {
        setBroken(false);
        onLoad?.(e);
      }}
      {...rest}
    />
  );
}

/**
 * 로드 실패·빈 `src` 시 깨진 아이콘 대신 정돈된 플레이스홀더(또는 `fallback`)를 씁니다.
 * `src`가 바뀌면 내부가 리마운트되어 다시 로드를 시도합니다.
 */
export function SafeImage({ src, ...rest }: SafeImageProps) {
  const trimmed = typeof src === "string" ? src.trim() : "";
  const resolved = trimmed ? publicAssetUrl(trimmed) ?? trimmed : "";
  return <SafeImageBody key={trimmed || "__empty__"} trimmed={resolved} {...rest} />;
}
