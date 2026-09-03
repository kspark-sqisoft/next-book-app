// RSC: `/playlists` — 크레타 플레이리스트 목록
//
// 목록을 서버에서 미리 받아 HTML과 함께 보낸다(클라이언트 왕복 제거). 화면 컴포넌트는
// 그대로 클라이언트이고 같은 쿼리 키로 읽는다 — 키가 어긋나면 시드가 조용히 무시되므로
// 양쪽 모두 `cretaKeys` 를 쓴다.
//
// `await` 하지 않는 이유: 셸을 먼저 내보내 첫 페인트를 늦추지 않기 위해서다.
// 서버가 마크업까지 그려야 하는 화면이라면 `void` 를 `await` 로 바꾸면 된다
// (측정: 이 화면 기준 TTFB 약 54ms → 125ms, 대신 카드가 HTML에 렌더된다).
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { listCretaPlaylistsAction } from "@/actions/creta";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getQueryClient } from "@/lib/query-client";
import { cretaKeys } from "@/lib/query-keys";
import { PlaylistListPage } from "@/page-components/PlaylistListPage";

/**
 * 사용자별 데이터라 요청 시점 렌더가 맞다.
 *
 * 보통 `cookies()` 사용은 라우트를 자동으로 동적으로 만들지만, 여기서는 프리페치를
 * `await` 하지 않아 쿠키 읽기가 렌더 추적 밖(액션 안)에서 일어나 자동 감지가 안 된다.
 * 명시하지 않으면 빌드가 정적 프리렌더를 시도하다 "Dynamic server usage" 로 실패한다.
 */
export const dynamic = "force-dynamic";

export default function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery({
    queryKey: cretaKeys.playlists(),
    queryFn: () => listCretaPlaylistsAction(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProtectedRoute>
        <PlaylistListPage />
      </ProtectedRoute>
    </HydrationBoundary>
  );
}
