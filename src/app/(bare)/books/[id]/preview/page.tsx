// 슬라이드쇼 미리보기(전체화면·자동 진행·iframe 임베드)
//
// 북을 서버에서 미리 받아 HTML에 실어 보낸다. 화면 컴포넌트는 그대로 클라이언트이고 같은
// 쿼리 키(`bookKeys.detail`)로 읽으므로 "불러오는 중…" 을 거치지 않고 바로 슬라이드가 뜬다.
// 커뮤니티·디바이스 상세가 이 라우트를 iframe 으로 박아 두므로, 여기서의 한 박자가 그 화면의
// 깜빡임이 된다.
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getBookAction } from "@/actions/books";
import {
  getCretaAdSettingAction,
  listCretaAdActiveCreativesAction,
} from "@/actions/creta-ads";
import { getQueryClient } from "@/lib/query-client";
import { bookKeys, cretaKeys } from "@/lib/query-keys";
import { BookPresentationPage } from "@/page-components/BookPresentationPage";

/** 북 상세는 저장 직후 바로 최신이어야 한다 — 요청 시점 렌더 */
export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ device?: string }>;
}) {
  const [{ id: idParam }, { device }] = await Promise.all([
    params,
    searchParams,
  ]);
  const id = Number(idParam);
  // 클라이언트의 `readPreviewDeviceParam()` 과 같은 규칙 — 양의 정수만, 아니면 null
  const deviceNum = Number(device);
  const deviceId =
    device != null && Number.isInteger(deviceNum) && deviceNum > 0
      ? deviceNum
      : null;
  const queryClient = getQueryClient();

  // 광고 위젯이 첫 렌더에서 바로 소재를 고를 수 있게 — 둘 다 공개 조회라 서버에서 안전하다.
  // 없으면 위젯이 소재 목록을 받기까지 슬라이드 배경만 보이다가 광고가 뒤늦게 나타난다.
  void queryClient.prefetchQuery({
    queryKey: cretaKeys.adActiveCreatives(deviceId),
    queryFn: () => listCretaAdActiveCreativesAction(deviceId),
  });
  void queryClient.prefetchQuery({
    queryKey: cretaKeys.adSetting(),
    queryFn: () => getCretaAdSettingAction(),
  });

  // 클라이언트와 같은 키·같은 액션. 잘못된 id 는 화면 컴포넌트가 안내하므로 여기서는 건너뛴다.
  if (Number.isFinite(id) && id > 0) {
    // await 하지 않는다 — 렌더를 막지 않고 시작만 시킨다(lib/query-client.ts 의 pending 직렬화).
    void queryClient.prefetchQuery({
      queryKey: bookKeys.detail(id),
      queryFn: () => getBookAction(id),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BookPresentationPage />
    </HydrationBoundary>
  );
}
