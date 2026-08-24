import { expect, test } from "@playwright/test";

import { signupUser } from "./helpers/auth";

/**
 * 북 목록 "새 북" — 제목 다이얼로그로 생성 후 편집 화면 진입, 뒤로 가기는 북 목록으로(플레이리스트 아님).
 * 계정은 매 실행 고유 이메일로 API 가입(book-crud.spec과 동일 패턴).
 */
test("새 북 다이얼로그 생성 → 편집 화면 → 뒤로 가기는 북 목록", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  const email = `e2e-bc-${Date.now()}@example.com`;
  const password = "e2e-pass-123!";
  await signupUser(request, { email, password, name: "E2E 새 북" });

  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/me$/, { timeout: 15_000 });

  // 플레이리스트 → 북 목록 순으로 진입(뒤로 가기가 플레이리스트로 새지 않는지 확인용)
  await page.goto("/playlists");
  await page.getByRole("link", { name: "스튜디오" }).first().click();
  await page.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });

  await page.getByRole("button", { name: "새 북" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "새 북" })).toBeVisible();
  // 제목이 비면 만들기 비활성
  await expect(dialog.getByRole("button", { name: "만들기" })).toBeDisabled();

  const bookTitle = `E2E 다이얼로그 북 ${Date.now()}`;
  await dialog.getByLabel("제목").fill(bookTitle);
  await dialog.getByLabel("제목").press("Enter"); // Enter로도 생성

  await page.waitForURL(/\/books\/\d+$/, { timeout: 20_000 });
  await expect(page.getByPlaceholder("북 제목")).toHaveValue(bookTitle, {
    timeout: 10_000,
  });

  // 뒤로 가기 → 북 목록(플레이리스트 아님)
  await page.getByRole("button", { name: "뒤로 가기" }).click();
  await page.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });
  await expect(page.getByText(bookTitle).first()).toBeVisible({
    timeout: 10_000,
  });

  // 정리: 상세로 들어가 북 삭제
  await page.getByText(bookTitle).first().click();
  await page.waitForURL(/\/books\/\d+$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "삭제" }).first().click();
  await page.getByRole("button", { name: /^삭제/ }).last().click();
  await page.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });
});
