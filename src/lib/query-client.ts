import { QueryClient } from "@tanstack/react-query";
import { installQueryCacheHitLogging } from "@/lib/install-query-cache-hit-logging";

/** 앱 전역 단일 인스턴스 — `main`의 Provider와 스토어 등에서 동일 참조로 무효화할 때 사용 */
export const queryClient = new QueryClient({
  /** 개별 `useQuery`에서 덮어쓰지 않으면 여기 값이 기본으로 적용됩니다. */
  defaultOptions: {
    queries: {
      /**
       * 데이터를 “신선”하다고 보는 시간(ms).
       * 이 안에는 같은 키로 다시 마운트돼도 네트워크 재요청을 하지 않고 캐시를 씁니다.
       * 지나면 stale이 되어 포커스 복귀 등의 조건에서 백그라운드 refetch가 일어날 수 있습니다.
       * 30초
       */
      staleTime: 30_000,
      /** 쿼리 실패 시 자동 재시도 횟수(첫 시도 제외). 1이면 총 최대 2번까지 시도합니다. */
      retry: 1,
      /** 브라우저 탭이 다시 활성화될 때 stale인 쿼리를 백그라운드에서 다시 가져옵니다. */
      refetchOnWindowFocus: true,
    },
  },
});

/** DEV: staleTime 안에서 캐시만으로 화면이 채워질 때 콘솔에 `[RQ-CACHE HIT]` 로그 */
installQueryCacheHitLogging(queryClient);
