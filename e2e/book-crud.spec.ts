import { expect, test } from "@playwright/test";

import { signupUser } from "./helpers/auth";

/**
 * 로그인 → 북 생성 → 저장 → 삭제까지 실제 사용자 흐름 1개.
 * 계정은 매 실행 고유 이메일로 API 가입(레이트 리밋: signup 5/분 이내).
 */
test("로그인 후 북 생성·저장·삭제", async ({ page, request }) => {
  test.setTimeout(120_000); // 가입 레이트 리밋 재시도 포함
  const email = `e2e-${Date.now()}@example.com`;
  const password = "e2e-pass-123!";

  await signupUser(request, { email, password, name: "E2E 사용자" });

  // 로그인
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/me$/, { timeout: 15_000 });

  // 새 북 작성
  await page.goto("/books/new");
  const titleInput = page.getByPlaceholder("북 제목");
  await titleInput.waitFor({ timeout: 15_000 });
  const bookTitle = `E2E 북 ${Date.now()}`;
  await titleInput.fill(bookTitle);
  await page.getByRole("button", { name: "저장" }).click();

  // 저장 성공 시 /books/:id 로 이동
  await page.waitForURL(/\/books\/\d+$/, { timeout: 20_000 });
  await expect(page.getByPlaceholder("북 제목")).toHaveValue(bookTitle, {
    timeout: 10_000,
  });

  // 삭제 (확인 다이얼로그 포함)
  await page.getByRole("button", { name: "삭제" }).first().click();
  const confirm = page.getByRole("button", { name: /^삭제/ }).last();
  await confirm.click();
  await page.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });

  // 목록에서 사라졌는지 확인
  await expect(page.getByText(bookTitle)).toHaveCount(0);
});
