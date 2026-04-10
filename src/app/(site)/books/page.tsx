// 북 목록: 검색·무한 스크롤 상태를 URL 과 동기화하므로 Suspense 로 감쌈
import { Suspense } from "react";

import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
import { BookListPage } from "@/page-components/BookListPage";

export default function Page() {
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <BookListPage />
    </Suspense>
  );
}
