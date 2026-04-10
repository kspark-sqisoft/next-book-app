// RSC: `/cats` 라우트는 클라이언트 목록 페이지만 마운트
import { CatsPage } from "@/page-components/CatsPage";

export default function Page() {
  return <CatsPage />; // 데이터는 내부에서 서버 액션·React Query로 로드
}
