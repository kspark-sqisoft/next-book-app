import { expect, test } from "@playwright/test";

import { E2E_PASSWORD, loginUser, signupUser } from "./helpers/auth";

/** 1×1 PNG — 업로드 픽스처 */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * 모든 사용자 공유: 북 공유 다이얼로그의 "모든 사용자" 토글 → 다른 사용자도 편집 UI.
 * 헤더에는 "전체 공유 북" 배지가 보인다.
 */
test("북 모든 사용자 공유 — 토글 후 다른 사용자 편집 가능", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const owner = {
    email: `e2e-owner-${stamp}@example.com`,
    name: `E2E 전체공유 작성자 ${stamp}`,
  };
  const guest = {
    email: `e2e-guest-${stamp}@example.com`,
    name: `E2E 전체공유 게스트 ${stamp}`,
  };
  for (const u of [owner, guest]) {
    await signupUser(request, { ...u, password: E2E_PASSWORD });
  }

  // 작성자: 북 생성 → 공유 다이얼로그에서 "모든 사용자" 켜기
  await loginUser(page, owner.email);
  await page.goto("/books/new");
  await page.getByPlaceholder("북 제목").fill(`E2E 전체 공유 북 ${stamp}`);
  await page.getByRole("button", { name: "저장" }).click();
  await page.waitForURL(/\/books\/\d+$/, { timeout: 20_000 });
  const bookUrl = page.url();

  await page.getByRole("button", { name: /^공유/ }).click();
  const allToggle = page
    .getByRole("dialog")
    .getByRole("checkbox", { name: /모든 사용자 공유/ });
  await expect(allToggle).toHaveAttribute("aria-checked", "false");
  await allToggle.click();
  await expect(allToggle).toHaveAttribute("aria-checked", "true", {
    timeout: 10_000,
  });
  await expect(page.getByText("모든 사용자에게 공유했습니다.")).toBeVisible();
  // 공유 UI는 팝오버(닫기 버튼 없음) — Escape로 닫는다
  await page.keyboard.press("Escape");

  // 다른 사용자: 편집 UI(저장)가 보이고 헤더에 "전체 공유 북" 배지
  const ctx = await browser.newContext();
  const gp = await ctx.newPage();
  await loginUser(gp, guest.email);
  await gp.goto(bookUrl);
  await expect(gp.getByRole("button", { name: "저장" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(gp.getByText("전체 공유 북")).toBeVisible();
  await ctx.close();

  // 정리: 작성자가 삭제
  await page.getByRole("button", { name: "삭제" }).first().click();
  await page.getByRole("button", { name: /^삭제/ }).last().click();
  await page.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });
});

/**
 * 미디어 파일 공유: 작성자가 자기 북 라이브러리에 업로드한 파일을 "모든 사용자"에게
 * 공유하면, 다른 사용자가 만든 북의 미디어 라이브러리 「공유받은 파일」에 나타난다.
 */
test("미디어 라이브러리 파일 공유 — 다른 사용자 북에서 보임", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const owner = {
    email: `e2e-owner-m-${stamp}@example.com`,
    name: `E2E 미디어 작성자 ${stamp}`,
  };
  const guest = {
    email: `e2e-guest-m-${stamp}@example.com`,
    name: `E2E 미디어 게스트 ${stamp}`,
  };
  for (const u of [owner, guest]) {
    await signupUser(request, { ...u, password: E2E_PASSWORD });
  }

  // 작성자: 북 생성 → 미디어 탭 → 업로드 → 파일 공유(모든 사용자)
  await loginUser(page, owner.email);
  await page.goto("/books/new");
  await page.getByPlaceholder("북 제목").fill(`E2E 미디어 북 ${stamp}`);
  await page.getByRole("button", { name: "저장" }).click();
  await page.waitForURL(/\/books\/\d+$/, { timeout: 20_000 });
  const ownerBookUrl = page.url();

  await page
    .getByRole("button", { name: "미디어 라이브러리", exact: true })
    .click();
  // 떠 있는 창과 구분: "떠 있는 창" 버튼이 있는 왼쪽 도크 패널만
  const mediaRegion = page
    .getByRole("region", { name: "미디어 라이브러리" })
    .filter({ has: page.getByRole("button", { name: "떠 있는 창" }) });
  await expect(mediaRegion).toBeVisible();
  await mediaRegion.locator('input[type="file"]').setInputFiles({
    name: "e2e-share.png",
    mimeType: "image/png",
    buffer: PNG_1PX,
  });
  await expect(
    page.getByText("라이브러리에 이미지를 추가했습니다."),
  ).toBeVisible({ timeout: 20_000 });

  await mediaRegion.getByRole("button", { name: "파일 공유" }).click();
  const allToggle = page
    .getByRole("dialog")
    .getByRole("checkbox", { name: /모든 사용자 공유/ });
  await allToggle.click();
  await expect(allToggle).toHaveAttribute("aria-checked", "true", {
    timeout: 10_000,
  });
  await page.keyboard.press("Escape");

  // 다른 사용자: 자기 북을 만들고 미디어 탭 → 「공유받은 파일」에 보인다
  const ctx = await browser.newContext();
  const gp = await ctx.newPage();
  await loginUser(gp, guest.email);
  await gp.goto("/books/new");
  await gp.getByPlaceholder("북 제목").fill(`E2E 게스트 북 ${stamp}`);
  await gp.getByRole("button", { name: "저장" }).click();
  await gp.waitForURL(/\/books\/\d+$/, { timeout: 20_000 });
  const guestBookUrl = gp.url();

  await gp
    .getByRole("button", { name: "미디어 라이브러리", exact: true })
    .click();
  const guestRegion = gp
    .getByRole("region", { name: "미디어 라이브러리" })
    .filter({ has: gp.getByRole("button", { name: "떠 있는 창" }) });
  await expect(guestRegion.getByText("공유받은 파일")).toBeVisible({
    timeout: 20_000,
  });
  await expect(guestRegion.getByText(owner.name)).toBeVisible();

  // 정리: 각자 북 삭제
  await gp.goto(guestBookUrl);
  await gp.getByRole("button", { name: "삭제" }).first().click();
  await gp.getByRole("button", { name: /^삭제/ }).last().click();
  await gp.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });
  await ctx.close();

  await page.goto(ownerBookUrl);
  await page.getByRole("button", { name: "삭제" }).first().click();
  await page.getByRole("button", { name: /^삭제/ }).last().click();
  await page.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });
});
