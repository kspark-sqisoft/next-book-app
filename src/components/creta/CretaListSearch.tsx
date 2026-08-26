"use client";

// 목록 검색바 — 스튜디오(북 목록)와 같은 모양. 크레타 목록들이 공유한다.
//
// 스튜디오는 서버 페이지네이션이라 URL 동기·서버 질의를 하지만, 나머지 목록은 전체를
// 한 번에 받아 두므로 여기서는 입력만 담당하고 걸러내기는 호출 측에서 즉시 한다.
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CretaListSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  /** 예: "플레이리스트 이름 검색…" */
  placeholder: string;
  /** 스크린리더용 이름 — 예: "플레이리스트 검색" */
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative max-w-md", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pr-9 pl-9"
        autoComplete="off"
        aria-label={label}
      />
      {value ? (
        <button
          type="button"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="검색어 지우기"
          onClick={() => onChange("")}
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** 검색어 정규화 — 앞뒤 공백 제거 + 소문자. 빈 문자열이면 필터하지 않는다는 뜻 */
export function normalizeCretaSearch(q: string): string {
  return q.trim().toLowerCase();
}

/** 여러 필드 중 하나라도 검색어를 포함하면 통과 */
export function matchesCretaSearch(
  q: string,
  ...fields: (string | null | undefined)[]
): boolean {
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}
