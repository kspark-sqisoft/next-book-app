import { expect, test } from "@playwright/test";

/** 공개·보조 REST·tRPC (DB·키 설정에 따라 일부는 503 가능). 글·북·Cats는 서버 액션 위주. */
test("GET /api/trpc/health", async ({ request }) => {
  const res = await request.get("/api/trpc/health");
  expect(res.ok()).toBeTruthy();
  const text = await res.text();
  expect(text.length).toBeGreaterThan(0);
});

test("GET /api/weather/seoul — 키 없으면 503·있으면 200", async ({
  request,
}) => {
  const res = await request.get("/api/weather/seoul");
  expect([200, 503].includes(res.status())).toBe(true);
});

test("GET /api/news/headlines — 키 없으면 503·있으면 200", async ({
  request,
}) => {
  const res = await request.get("/api/news/headlines?country=kr&pageSize=1");
  expect([200, 503].includes(res.status())).toBe(true);
});
