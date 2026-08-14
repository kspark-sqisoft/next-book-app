import { expect, test } from "@playwright/test";

/** 공개·보조 REST·tRPC. 외부 API 키 유무와 무관하게 판정이 흔들리지 않도록 응답 본문까지 확인한다. */
test("GET /api/trpc/health", async ({ request }) => {
  const res = await request.get("/api/trpc/health");
  expect(res.ok()).toBeTruthy();
  // superjson 변환 계층 포함: {result:{data:{json:{ok:true}}}}
  const json = (await res.json()) as {
    result?: { data?: { json?: { ok?: boolean } } };
  };
  expect(json.result?.data?.json?.ok).toBe(true);
});

test("GET /api/weather/seoul — 200이면 스키마, 키 없으면 503만 허용(그 외 상태는 실패)", async ({
  request,
}) => {
  const res = await request.get("/api/weather/seoul");
  const status = res.status();
  if (status === 200) {
    const json = (await res.json()) as Record<string, unknown>;
    // 완전 고장이 200으로 위장하지 못하게 최소 스키마 확인
    expect(typeof json).toBe("object");
    expect(json).not.toBeNull();
  } else {
    // 키 미설정 환경(CI)만 503 허용 — 4xx/5xx 다른 상태는 회귀로 판정
    expect(status, `unexpected status ${status}`).toBe(503);
  }
});

test("GET /api/news/headlines — 200이면 스키마, 키 없으면 503만 허용(그 외 상태는 실패)", async ({
  request,
}) => {
  const res = await request.get("/api/news/headlines?country=kr&pageSize=1");
  const status = res.status();
  if (status === 200) {
    const json = (await res.json()) as { articles?: unknown };
    expect(Array.isArray(json.articles)).toBe(true);
  } else {
    expect(status, `unexpected status ${status}`).toBe(503);
  }
});
