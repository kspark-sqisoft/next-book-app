"use client";

// 목록 보기 형태(리스트/그리드) 전환 — 디바이스 목록 패턴을 공용화한 훅 + 버튼 쌍.
import { LayoutGrid, List } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export type CretaListView = "list" | "grid";

/** 보기 형태를 localStorage에 기억(서버 렌더와 어긋나지 않게 마운트 후 복원) */
export function useCretaListView(
  storageKey: string,
  fallback: CretaListView = "list",
) {
  const [view, setView] = useState<CretaListView>(fallback);
  useEffect(() => {
    // 마운트 후 저장된 보기 형태 복원 — 동기 setState 경고 회피를 위해 microtask로
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved === "list" || saved === "grid") setView(saved);
      } catch {
        /* 저장소 접근 불가 시 기본값 유지 */
      }
    });
  }, [storageKey]);
  const changeView = (next: CretaListView) => {
    setView(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  };
  return [view, changeView] as const;
}

/** 리스트/그리드 전환 버튼 쌍 */
export function CretaViewToggle({
  view,
  onChange,
}: {
  view: CretaListView;
  onChange: (view: CretaListView) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border p-0.5">
      <Button
        type="button"
        variant={view === "list" ? "secondary" : "ghost"}
        size="icon-sm"
        className="size-7"
        aria-label="리스트 보기"
        aria-pressed={view === "list"}
        onClick={() => onChange("list")}
      >
        <List className="size-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant={view === "grid" ? "secondary" : "ghost"}
        size="icon-sm"
        className="size-7"
        aria-label="그리드 보기"
        aria-pressed={view === "grid"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
