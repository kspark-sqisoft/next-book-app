import { expect, test } from "@playwright/test";

/**
 * E2E — Next.js Playwright 가이드: baseURL + 상대 경로 navigation
 * https://nextjs.org/docs/app/guides/testing/playwright
 */
test("로그인 폼이 보인다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});

test("로그인에서 회원가입 링크로 이동한다", async ({ page }) => {
  await page.goto("/login");
  /* 헤더·푸터에도 동일 문구 링크가 있어 폼 영역으로 한정 */
  await page.locator("form").getByRole("link", { name: "회원가입" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByRole("button", { name: "가입하기" })).toBeVisible();
});
