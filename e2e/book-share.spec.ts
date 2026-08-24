import { expect, test } from "@playwright/test";

import { signupUser } from "./helpers/auth";

/**
 * 북 공유: 작성자가 상세 헤더 "공유"에서 회원을 골라 공유 → 공유받은 회원은 편집(저장) 가능,
 * 다시 열면 공유된 회원이 체크되어 있다. 계정 2개를 매 실행 API 가입으로 만든다.
 */
test("북 공유 — 회원 목록 체크, 공유받은 사용자 편집 가능", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const password = "e2e-pass-123!";
  const owner = { email: `e2e-owner-${stamp}@example.com`, name: "E2E 작성자" };
  const guest = {
    email: `e2e-guest-${stamp}@example.com`,
    name: `E2E 공유대상 ${stamp}`,
  };
  for (const u of [owner, guest]) {
    await signupUser(request, { ...u, password });
  }

  // 작성자: 로그인 → 북 생성
  await page.goto("/login");
  await page.fill('input[name="email"]', owner.email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/me$/, { timeout: 15_000 });
  await page.goto("/books/new");
  await page.getByPlaceholder("북 제목").fill(`E2E 공유 북 ${stamp}`);
  await page.getByRole("button", { name: "저장" }).click();
  await page.waitForURL(/\/books\/\d+$/, { timeout: 20_000 });
  const bookUrl = page.url();

  // 헤더: 작성자 이름 표시, 내 북이므로 "공유받은 북" 배지는 없다
  await expect(page.getByText(`작성자 ${owner.name}`)).toBeVisible();
  await expect(page.getByText("공유받은 북")).toHaveCount(0);

  // 공유 다이얼로그: 대상 검색 → 체크 → 다시 열어도 체크 유지
  await page.getByRole("button", { name: /^공유/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("회원 검색").fill(String(stamp));
  const row = dialog.getByRole("checkbox", { name: new RegExp(guest.name) });
  await expect(row).toHaveAttribute("aria-checked", "false", {
    timeout: 15_000,
  });
  await row.click();
  await expect(row).toHaveAttribute("aria-checked", "true", {
    timeout: 10_000,
  });
  await expect(dialog.getByText("공유 중 1명")).toBeVisible();
  await dialog.screenshot({ path: "test-results/book-share-dialog.png" });
  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("button", { name: /^공유/ })).toContainText("1");
  await page.getByRole("button", { name: /^공유/ }).click();
  await page.getByRole("dialog").getByLabel("회원 검색").fill(String(stamp));
  await expect(
    page
      .getByRole("dialog")
      .getByRole("checkbox", { name: new RegExp(guest.name) }),
  ).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  await page.getByRole("dialog").getByRole("button", { name: "닫기" }).click();

  // 공유받은 회원: 별도 컨텍스트로 로그인 → 편집 UI(저장 버튼)가 보이고 공유 버튼은 없다
  const ctx = await browser.newContext();
  const gp = await ctx.newPage();
  await gp.goto("/login");
  await gp.fill('input[name="email"]', guest.email);
  await gp.fill('input[name="password"]', password);
  await gp.getByRole("button", { name: "로그인" }).click();
  await gp.waitForURL(/\/me$/, { timeout: 15_000 });
  await gp.goto(bookUrl);
  await expect(gp.getByRole("button", { name: "저장" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(gp.getByRole("button", { name: /^공유/ })).toHaveCount(0);
  // 헤더: 작성자 이름 + "공유받은 북" 배지
  await expect(gp.getByText(`작성자 ${owner.name}`)).toBeVisible();
  await expect(gp.getByText("공유받은 북")).toBeVisible();
  await gp.getByPlaceholder("북 제목").fill(`E2E 공유 북 ${stamp} (편집됨)`);
  await gp.getByRole("button", { name: "저장" }).click();
  await expect(gp.getByText("저장했습니다.")).toBeVisible({ timeout: 15_000 });
  await ctx.close();

  // 목록 카드: 작성자 + "○○에게 공유됨"
  await page.goto("/books");
  const card = page
    .getByRole("listitem")
    .filter({ hasText: `E2E 공유 북 ${stamp}` })
    .first();
  await expect(card.getByText(`${guest.name}에게 공유됨`)).toBeVisible({
    timeout: 15_000,
  });
  await expect(card.getByText(owner.name)).toBeVisible();
  await card.screenshot({ path: "test-results/book-share-card.png" });
  await page.goto(bookUrl);
  await page.getByRole("button", { name: "저장" }).waitFor({ timeout: 20_000 });

  // 정리: 작성자가 삭제
  await page.getByRole("button", { name: "삭제" }).first().click();
  await page.getByRole("button", { name: /^삭제/ }).last().click();
  await page.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });
});
