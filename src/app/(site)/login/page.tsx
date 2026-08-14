// 로그인: 쿼리는 LoginPage 에서 window.location 으로 읽음(useSearchParams·Suspense 회피)
import { LoginPage } from "@/page-components/LoginPage";

export default function Page() {
  return <LoginPage />;
}
