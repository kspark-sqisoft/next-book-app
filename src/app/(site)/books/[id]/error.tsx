"use client";

// 북 편집기 전용 에러 바운더리 — 캔버스 예외에도 목록 복귀·재시도 경로를 남긴다
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function BookError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-base font-semibold">
        편집기를 불러오는 중 문제가 발생했습니다.
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.digest ? `오류 코드: ${error.digest}` : error.message}
      </p>
      <div className="mt-2 flex gap-2">
        <Button type="button" onClick={reset}>
          다시 시도
        </Button>
        <Button variant="outline" asChild>
          <Link href="/books">북 목록으로</Link>
        </Button>
      </div>
    </div>
  );
}
