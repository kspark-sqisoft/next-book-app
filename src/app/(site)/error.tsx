"use client";

// (site) 세그먼트 공통 에러 바운더리 — 렌더 예외 1건이 앱 전체 백지로 번지는 것을 막는다
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-base font-semibold">
        화면을 표시하는 중 문제가 발생했습니다.
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.digest ? `오류 코드: ${error.digest}` : error.message}
      </p>
      <div className="mt-2 flex gap-2">
        <Button type="button" onClick={reset}>
          다시 시도
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">홈으로</Link>
        </Button>
      </div>
    </div>
  );
}
