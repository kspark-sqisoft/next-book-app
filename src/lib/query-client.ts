import {
  defaultShouldDehydrateQuery,
  isServer,
  QueryClient,
} from "@tanstack/react-query";

import { installQueryCacheHitLogging } from "@/lib/install-query-cache-hit-logging";

/**
 * QueryClient 는 **서버에서 요청마다 새로, 브라우저에서는 싱글턴**이어야 한다.
 *
 * 이전에는 모듈 최상위에서 하나를 만들어 export 했다. 서버에서 이 캐시에 쓰는 코드가
 * 없던 동안에는 무해했지만, 서버 프리페치를 넣는 순간 **요청 사이에 캐시가 공유되어
 * 한 사용자의 목록·상세가 다른 사용자에게 그대로 보인다.** 그래서 프리페치 도입 전에
 * 이 분리를 먼저 한다.
 */
function makeQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 이 시간 동안은 캐시를 fresh로 간주
        retry: 1, // 실패 시 1회 재시도
        refetchOnWindowFocus: true, // 탭 복귀 시 stale이면 refetch
      },
      dehydrate: {
        /**
         * 서버 프리페치는 `await` 하지 않고 시작만 한다(렌더를 막지 않으려고).
         * 기본 규칙은 pending 쿼리를 직렬화에서 빼므로, 그대로 두면 시드가 **빈 채로**
         * 전달되고 클라이언트가 처음부터 다시 받는다 — 아무 경고도 없다.
         */
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
  installQueryCacheHitLogging(client);
  return client;
}

/** 브라우저 싱글턴 — 서버에서는 절대 채우지 않는다 */
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) {
    // 요청마다 새로: 한 요청 안에서 프리페치와 dehydrate 가 같은 인스턴스를 쓰도록
    // 호출부(서버 컴포넌트)에서 한 번만 부른다.
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
