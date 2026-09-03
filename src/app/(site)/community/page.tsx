// 크레타 > 커뮤니티: 모든 사용자의 북·플레이리스트 갤러리
//
// 목록 두 개를 서버에서 미리 받아 HTML에 실어 보낸다. 화면 컴포넌트는 그대로 클라이언트이고
// 같은 쿼리 키로 읽으므로, 첫 렌더가 빈 상태에서 시작하지 않는다.
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { listBooksAction } from "@/actions/books";
import { listPublicCretaPlaylistsAction } from "@/actions/creta";
import { getQueryClient } from "@/lib/query-client";
import { bookKeys, cretaKeys } from "@/lib/query-keys";
import {
  COMMUNITY_BOOKS_TAKE,
  CommunityPage,
} from "@/page-components/CommunityPage";

/**
 * 갤러리는 항상 현재 데이터를 보여야 한다.
 *
 * 이 라우트의 프리페치는 공개 액션이라 쿠키를 읽지 않고, 그래서 Next 가 정적 프리렌더
 * 대상으로 본다 — 그러면 **빌드 시점 목록이 HTML에 구워져** 모든 방문자에게 나가고,
 * 게시가 내려간 북이 잠깐 보였다 사라지는 식이 된다. 프리페치 이전 동작(매 요청 최신)에
 * 맞춰 요청 시점 렌더로 고정한다.
 */
export const dynamic = "force-dynamic";

export default function Page() {
  const queryClient = getQueryClient();

  // await 하지 않는다 — 렌더를 막지 않고 시작만 시킨다.
  // pending 상태로 직렬화되도록 dehydrate 규칙을 열어 두었다(lib/query-client.ts).
  void queryClient.prefetchQuery({
    queryKey: [...bookKeys.lists(), "community"],
    queryFn: () =>
      listBooksAction({ take: COMMUNITY_BOOKS_TAKE, publishedOnly: true }),
  });
  void queryClient.prefetchQuery({
    queryKey: cretaKeys.publicPlaylists(),
    queryFn: () => listPublicCretaPlaylistsAction(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommunityPage />
    </HydrationBoundary>
  );
}
