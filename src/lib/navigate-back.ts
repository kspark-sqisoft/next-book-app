// 상세 화면 "뒤로" 공통 처리 — 목록·플레이리스트 등 진입했던 이전 화면으로
// 돌아가고, 직접 진입(새 탭·북마크·링크 공유)처럼 돌아갈 곳이 없으면 대체
// 경로로 보낸다. PostDetailPage에서 쓰던 휴리스틱을 공용화한 것.
import type { useRouter } from "next/navigation";

type AppRouter = ReturnType<typeof useRouter>;

export function goBackOrPush(router: AppRouter, fallbackHref: string): void {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
  } else {
    router.push(fallbackHref);
  }
}
