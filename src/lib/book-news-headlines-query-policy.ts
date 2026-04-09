import { useEffect, useState } from "react";

/**
 * 뉴스 위젯 React Query 주기·stale 정책.
 *
 * - 헤드라인은 분 단위로만 의미 있게 바뀌므로 초단위 폴링은 피합니다.
 * - NewsAPI 무료(일 100회 등)를 감안해 기본 약 10~12분 주기 + 쿼리키 기반 지터로
 *   여러 위젯·탭이 같은 시각에 몰리지 않게 합니다.
 * - 탭이 숨겨진 동안은 refetchInterval을 끄고, 다시 보이면 focus 시 기본 refetch로 맞춥니다.
 */

const MIN_REFETCH_MS = 6 * 60_000;
const MAX_REFETCH_MS = 16 * 60_000;
const BASE_REFETCH_MS = 9 * 60_000;

/** 간단 FNV-1a — 동일 키면 항상 같은 지터 */
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export type NewsHeadlinesRefetchParams = {
  country: string;
  /** 빈 문자열 = 카테고리 없음 */
  category: string;
  pageSize: number;
};

/**
 * 국가·카테고리·pageSize에 따라 6~16분 사이 간격(ms)을 잡고, 키별 지터를 더합니다.
 * - pageSize가 클수록 한 응답에 정보가 많아 소폭 간격을 늘림(과도한 요청 완화).
 * - 카테고리가 좁을수록 헤드라인 변화가 상대적으로 느릴 수 있어 소폭 간격을 늘림.
 */
export function computeNewsHeadlinesRefetchIntervalMs(p: NewsHeadlinesRefetchParams): number {
  const key = `${p.country}|${p.category}|${p.pageSize}`;
  let ms = BASE_REFETCH_MS;
  ms += Math.min(5, Math.max(1, p.pageSize)) * 25_000;
  if (p.category.length > 0) ms += 60_000;
  ms = Math.min(MAX_REFETCH_MS, Math.max(MIN_REFETCH_MS, ms));
  const jitter = stableHash(key) % 90_000;
  return ms + jitter;
}

/**
 * staleTime은 refetch 주기의 일부로 두어, 포커스 복귀·마운트 시 백그라운드 갱신이 자연스럽게 돕도록 함.
 */
export function newsHeadlinesStaleTimeMs(refetchIntervalMs: number): number {
  const t = Math.floor(refetchIntervalMs * 0.3);
  return Math.min(5 * 60_000, Math.max(90_000, t));
}

export function newsHeadlinesGcTimeMs(refetchIntervalMs: number): number {
  return Math.max(30 * 60_000, refetchIntervalMs * 3);
}

/** 백그라운드 탭에서는 폴링을 멈추고, 다시 보이면 주기·포커스 refetch로 맞춤 */
export function useTabVisibleForNewsPolling(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof document !== "undefined" ? document.visibilityState === "visible" : true,
  );
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}
