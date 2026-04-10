// 브라우저 단일 QueryClient: 기본 stale/retry + 개발 시 캐시 히트 로깅
import { QueryClient } from "@tanstack/react-query";

import { installQueryCacheHitLogging } from "@/lib/install-query-cache-hit-logging";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 이 시간 동안은 캐시를 fresh로 간주
      retry: 1, // 실패 시 1회 재시도
      refetchOnWindowFocus: true, // 탭 복귀 시 stale이면 refetch
    },
  },
});

installQueryCacheHitLogging(queryClient);
