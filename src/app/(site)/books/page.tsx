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
