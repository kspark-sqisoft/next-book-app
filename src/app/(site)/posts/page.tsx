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
