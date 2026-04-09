"use client";

import { lazy, Suspense, useState } from "react";

import { HomeDirtyFigmaOverlay } from "@/components/home/HomeDirtyFigmaOverlay";
import { cn } from "@/lib/utils";

const HomeHero3D = lazy(() =>
  import("@/components/home/HomeHero3D").then((m) => ({
    default: m.HomeHero3D,
  })),
);

const HomeHeroCards3D = lazy(() =>
  import("@/components/home/HomeHeroCards3D").then((m) => ({
    default: m.HomeHeroCards3D,
  })),
);

const HomeHeroEnvmap3D = lazy(() =>
  import("@/components/home/HomeHeroEnvmap3D").then((m) => ({
    default: m.HomeHeroEnvmap3D,
  })),
);

const HERO_COUNT = 3;

/**
 * 홈: 보블 히어로(zxpv7)일 때만 `DirtyFigmaExport` 타이포 오버레이. 그라데이션은 원본 `styles.css`에 맞춤.
 */
export function HomePage() {
  const [heroIndex, setHeroIndex] = useState(0);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,#e6eaf5_0%,#f6f6f6_80%)] dark:bg-[linear-gradient(180deg,oklch(0.22_0_0)_0%,oklch(0.145_0_0)_80%)]">
      <Suspense
        fallback={
          <div
            className="min-h-0 flex-1 animate-pulse bg-muted/25"
            aria-hidden
          />
        }
      >
        {heroIndex === 0 && (
          <HomeHero3D className="relative z-0 min-h-0 flex-1" />
        )}
        {heroIndex === 1 && (
          <HomeHeroCards3D className="relative z-0 min-h-0 flex-1" />
        )}
        {heroIndex === 2 && (
          <HomeHeroEnvmap3D className="relative z-0 min-h-0 flex-1" />
        )}
      </Suspense>
      <div
        className="pointer-events-auto absolute bottom-5 left-0 right-0 z-20 flex justify-center gap-2"
        role="tablist"
        aria-label="홈 3D 히어로 전환"
      >
        {Array.from({ length: HERO_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={heroIndex === i}
            aria-label={
              i === 0
                ? "보블 히어로"
                : i === 1
                  ? "카드 히어로"
                  : "다이내믹 환경맵 히어로"
            }
            className={cn(
              "h-2.5 w-2.5 rounded-full border border-foreground/25 transition-[transform,background-color] duration-200",
              "hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              heroIndex === i ? "bg-foreground/90" : "bg-foreground/20",
            )}
            onClick={() => setHeroIndex(i)}
          />
        ))}
      </div>
      {heroIndex === 0 ? <HomeDirtyFigmaOverlay /> : null}
    </div>
  );
}
