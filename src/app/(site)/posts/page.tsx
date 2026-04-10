// 글 목록: 카테고리·검색 쿼리와 무한 스크롤
import { Suspense } from "react";

import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
import { PostListPage } from "@/page-components/PostListPage";

export default function Page() {
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <PostListPage />
    </Suspense>
  );
}
