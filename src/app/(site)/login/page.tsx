// 로그인: useSearchParams 때문에 Suspense 경계 필요
import { Suspense } from "react";

import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
import { LoginPage } from "@/page-components/LoginPage";

export default function Page() {
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <LoginPage />
    </Suspense>
  );
}
