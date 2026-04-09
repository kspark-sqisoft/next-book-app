import type { Query, QueryCacheNotifyEvent, QueryClient } from "@tanstack/react-query";
import { appLog } from "@/lib/app-log";

/**
 * React Query(TanStack Query)에서 **queryFn이 돌지 않고** 캐시된 성공 데이터가
 * 옵저버에 전달될 때만 로그를 남깁니다.
 *
 * 동작 요지:
 * - 한 배치 안에서는 `observerResultsUpdated`가 `updated`+`success`보다 먼저 처리되므로,
 *   `updated`+`success`에서 queryHash를 Set에 넣고, 같은 턴의 microtask에서 옵저버 쪽을 판별합니다.
 * - `fetchStatus === 'fetching'` 인 동안은 캐시 히트로 보지 않습니다.
 */
export function installQueryCacheHitLogging(queryClient: QueryClient): void {
  if (process.env.NODE_ENV === "production") return;

  const cache = queryClient.getQueryCache();
  /** 이번 배치에서 네트워크(또는 queryFn) 성공으로 갱신된 쿼리 — 캐시 히트 로그 제외 */
  const skipCacheHitForHashes = new Set<string>();
  /** 동일 데이터 시그니처로 중복 로그 방지 */
  const lastCacheHitSignature = new Map<string, string>();

  cache.subscribe((event: QueryCacheNotifyEvent) => {
    if (event.type === "updated" && event.action.type === "success") {
      skipCacheHitForHashes.add(event.query.queryHash);
      const hash = event.query.queryHash;
      queueMicrotask(() => {
        skipCacheHitForHashes.delete(hash);
      });
    }

    if (event.type !== "observerResultsUpdated") return;

    const query = event.query as Query;
    queueMicrotask(() => {
      if (skipCacheHitForHashes.has(query.queryHash)) return;
      if (query.state.status !== "success" || query.state.fetchStatus !== "idle")
        return;
      if (query.state.data === undefined) return;

      const sig = `${query.state.dataUpdatedAt}:${query.state.dataUpdateCount}`;
      if (lastCacheHitSignature.get(query.queryHash) === sig) return;
      lastCacheHitSignature.set(query.queryHash, sig);

      appLog("rq-cache", "[RQ-CACHE HIT] 캐시에서 데이터 반환 (queryFn 미실행)", {
        queryKey: query.queryKey,
        queryHash: query.queryHash,
        dataUpdatedAt: query.state.dataUpdatedAt,
        isStale: query.isStale(),
      });
    });
  });
}
