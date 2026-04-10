import type {
  Query,
  QueryCacheNotifyEvent,
  QueryClient,
} from "@tanstack/react-query";

import { appLog } from "@/lib/app-log";

// queryFn 없이 캐시만으로 화면이 채워질 때만 DEV 로그
export function installQueryCacheHitLogging(queryClient: QueryClient): void {
  if (process.env.NODE_ENV === "production") return;

  const cache = queryClient.getQueryCache();
  const skipCacheHitForHashes = new Set<string>(); // 방금 네트워크로 갱신된 해시
  const lastCacheHitSignature = new Map<string, string>(); // 중복 로그 방지

  cache.subscribe((event: QueryCacheNotifyEvent) => {
    if (event.type === "updated" && event.action.type === "success") {
      skipCacheHitForHashes.add(event.query.queryHash);
      const hash = event.query.queryHash;
      queueMicrotask(() => {
        skipCacheHitForHashes.delete(hash); // 같은 틱의 가짜 히트 방지
      });
    }

    if (event.type !== "observerResultsUpdated") return;

    const query = event.query as Query;
    queueMicrotask(() => {
      if (skipCacheHitForHashes.has(query.queryHash)) return;
      if (
        query.state.status !== "success" ||
        query.state.fetchStatus !== "idle"
      )
        return; // fetching 중이면 진짜 히트 아님
      if (query.state.data === undefined) return;

      const sig = `${query.state.dataUpdatedAt}:${query.state.dataUpdateCount}`;
      if (lastCacheHitSignature.get(query.queryHash) === sig) return;
      lastCacheHitSignature.set(query.queryHash, sig);

      appLog(
        "rq-cache",
        "[RQ-CACHE HIT] 캐시에서 데이터 반환 (queryFn 미실행)",
        {
          queryKey: query.queryKey,
          queryHash: query.queryHash,
          dataUpdatedAt: query.state.dataUpdatedAt,
          isStale: query.isStale(),
        },
      );
    });
  });
}
