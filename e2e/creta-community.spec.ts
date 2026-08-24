import { expect, type Page, test } from "@playwright/test";

import { signupUser } from "./helpers/auth";

/**
 * 크레타 > 커뮤니티(갤러리 → 상단 슬라이드쇼 + 2단 댓글) 와 크레타 > 계정(내 정보·내가 만든/공유받은 항목).
 * 계정은 매 실행 API 가입.
 */
const PASSWORD = "e2e-pass-123!";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/me$/, { timeout: 15_000 });
}

test("커뮤니티 댓글·답글과 계정 현황", async ({ page, request }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const me = {
    email: `e2e-cm-${stamp}@example.com`,
    name: `E2E 커뮤니티 ${stamp}`,
  };
  await signupUser(request, { ...me, password: PASSWORD });
  await login(page, me.email);

  // 북 하나 만들어 두기(갤러리·계정 현황 검증용)
  await page.goto("/books/new");
  const bookTitle = `E2E 커뮤니티 북 ${stamp}`;
  await page.getByPlaceholder("북 제목").fill(bookTitle);
  await page.getByRole("button", { name: "저장" }).click();
  await page.waitForURL(/\/books\/\d+$/, { timeout: 20_000 });
  const bookId = page.url().match(/\/books\/(\d+)$/)![1];

  // 커뮤니티 갤러리 → 내 북 카드 → 상세
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "커뮤니티" })).toBeVisible();
  const card = page
    .getByTestId("community-item")
    .filter({ hasText: bookTitle })
    .first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.click();
  await page.waitForURL(new RegExp(`/community/book/${bookId}$`), {
    timeout: 15_000,
  });
  await expect(page.getByTestId("community-player")).toHaveAttribute(
    "src",
    `/books/${bookId}/preview?embed=1`,
  );
  await expect(page.getByRole("heading", { name: bookTitle })).toBeVisible();

  // 댓글 → 답글(2단)
  const comments = page.getByRole("region", { name: "댓글" });
  await comments
    .getByPlaceholder("이 콘텐츠에 대한 의견을 남겨 보세요.")
    .fill("첫 댓글입니다");
  await comments.getByRole("button", { name: "댓글 등록" }).click();
  await expect(comments.getByText("첫 댓글입니다")).toBeVisible({
    timeout: 10_000,
  });
  await comments.getByRole("button", { name: /^답글/ }).first().click();
  await comments.getByPlaceholder(/답글…$/).fill("답글입니다");
  await comments.getByRole("button", { name: "답글 등록" }).click();
  await expect(comments.getByText("답글입니다")).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    comments.getByRole("heading", { name: /댓글\s*2/ }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/community-detail.png" });

  // 갤러리 카드의 댓글 수 배지 = 2
  await page.goto("/community");
  await expect(
    page.getByTestId("community-item").filter({ hasText: bookTitle }).first(),
  ).toContainText("2", { timeout: 20_000 });

  // 계정 현황: 내 정보 + 내가 만든 북
  await page.goto("/account");
  await expect(page.getByText(me.email)).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("link", { name: new RegExp(bookTitle) }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/account-page.png" });

  // 정리: 북 삭제(댓글도 함께 정리됨)
  await page.goto(`/books/${bookId}`);
  await page.getByRole("button", { name: "삭제" }).first().click();
  await page.getByRole("button", { name: /^삭제/ }).last().click();
  await page.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });
});
