import { type APIRequestContext, expect, type Page } from "@playwright/test";

export const E2E_PASSWORD = "e2e-pass-123!";

/**
 * API 가입 — signup 레이트 리밋(분당 5회)에 걸리면(429) 기다렸다 재시도.
 * 전체 스위트를 병렬로 돌릴 때 가입이 겹쳐 실패하지 않도록 한다.
 */
export async function signupUser(
  request: APIRequestContext,
  user: { email: string; name: string; password?: string },
): Promise<void> {
  const data = { ...user, password: user.password ?? E2E_PASSWORD };
  let last = 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await request.post("/api/auth/signup", { data });
    if (res.ok()) return;
    last = res.status();
    if (last !== 429) break;
    await new Promise((r) => setTimeout(r, 12_000 + attempt * 2_000));
  }
  expect(last, `signup 실패(status ${last})`).toBe(200);
}

export async function loginUser(
  page: Page,
  email: string,
  password: string = E2E_PASSWORD,
): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/me$/, { timeout: 15_000 });
}
