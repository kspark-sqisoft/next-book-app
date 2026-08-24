import { expect, test } from "@playwright/test";

import { signupUser } from "./helpers/auth";

/**
 * 텍스트 위젯 애니메이션: 편집기에서 효과 설정(인스펙터 미리보기) → 저장 → 슬라이드쇼(/preview)에서 재생.
 * 계정은 매 실행 고유 이메일로 API 가입(book-crud.spec과 동일 패턴).
 */
test("텍스트 위젯 애니메이션 — 인스펙터 미리보기와 프레젠테이션 재생", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000); // 편집·저장·슬라이드쇼까지 한 흐름(가입 재시도 포함)
  const email = `e2e-ta-${Date.now()}@example.com`;
  const password = "e2e-pass-123!";

  await signupUser(request, { email, password, name: "E2E 애니메이션" });

  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/me$/, { timeout: 15_000 });

  await page.goto("/books/new");
  const titleInput = page.getByPlaceholder("북 제목");
  await titleInput.waitFor({ timeout: 15_000 });
  const bookTitle = `E2E 텍스트 애니메이션 ${Date.now()}`;
  await titleInput.fill(bookTitle);

  // 위젯 팔레트(기본: 떠 있는 창) — 텍스트 항목 더블클릭으로 빠른 추가
  const palette = page.getByRole("region", { name: /위젯/ }).first();
  const textItem = palette
    .locator('[draggable="true"]', { hasText: "텍스트" })
    .first();
  await textItem.dblclick();

  // 1) 첫 위젯: 여러 줄 + 굵게 → 타이프라이터 2초
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("안녕하세요 Hello World 반갑습니다");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+B");
  await page.keyboard.type("두 번째 줄은 굵게");
  await page.keyboard.press("Control+B");

  await page.locator("#insp-text-anim").click();
  await page.getByRole("option", { name: "타이프라이터" }).click();
  await page.locator("#insp-text-anim-sec").fill("2");

  // 편집 캔버스에서도 바로 재생(글자 분할 확인)
  const canvasAnim = page.getByTestId("book-text-widget-animation").first();
  await expect(canvasAnim).toHaveClass(/book-ta--typewriter/);
  await expect(canvasAnim.locator("strong .bta-u").first()).toHaveText("두");

  // 인스펙터 미리보기: 글자 span 분할 + 서식 유지, 시간 변수 반영
  const preview = page.getByTestId("book-text-animation-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveClass(/book-ta--typewriter/);
  await expect(preview.locator("strong .bta-u").first()).toHaveText("두");
  await expect(preview).toHaveCSS("--bta-dur", "2s");
  const unitCount = await preview.locator(".bta-u").count();
  expect(unitCount).toBeGreaterThan(20);
  // 완료 후에는 모든 글자가 보여야 함(부동소수점 진행도 회귀 방지)
  await expect
    .poll(
      () =>
        preview.evaluate(
          (root) =>
            Array.from(root.querySelectorAll(".bta-u")).filter(
              (u) => getComputedStyle(u).visibility === "visible",
            ).length,
        ),
      { timeout: 6_000 },
    )
    .toBe(unitCount);

  // 2) 둘째 위젯: 가로 스크롤(마키)
  await textItem.dblclick();
  const editor2 = page.locator(".ProseMirror").first();
  await editor2.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(
    "가로 스크롤 테스트 — Marquee widget test 1234567890",
  );
  await page.locator("#insp-text-anim").click();
  await page.getByRole("option", { name: "가로 스크롤 (반복)" }).click();
  await expect(
    page.getByTestId("book-text-animation-preview").locator(".bta-copy"),
  ).toHaveCount(2);
  // 캔버스: 위젯 2개(타이프라이터 + 마키) 모두 재생 중
  await expect(page.getByTestId("book-text-widget-animation")).toHaveCount(2);
  await expect(
    page.getByTestId("book-text-widget-animation").filter({
      has: page.locator(".bta-track"),
    }),
  ).toHaveCount(1);

  await page.screenshot({ path: "test-results/text-animation-editor.png" });

  // 저장 → /books/:id
  await page.getByRole("button", { name: "저장" }).click();
  await page.waitForURL(/\/books\/\d+$/, { timeout: 20_000 });
  const bookId = page.url().match(/\/books\/(\d+)$/)?.[1];
  expect(bookId).toBeTruthy();

  // 슬라이드쇼(보기 모드): 타이프라이터는 글자 분할, 마키는 2벌 트랙
  await page.goto(`/books/${bookId}/preview`);
  const stageTypewriter = page.locator(".book-ta--typewriter").first();
  await expect(stageTypewriter).toBeVisible({ timeout: 15_000 });
  await expect(stageTypewriter.locator("strong .bta-u").first()).toHaveText(
    "두",
  );
  const marquee = page.locator(".book-ta--marquee").first();
  await expect(marquee.locator(".bta-copy")).toHaveCount(2);
  await expect(marquee.locator(".bta-track")).toHaveCSS(
    "animation-name",
    "bta-marquee",
  );
  await expect
    .poll(
      () =>
        stageTypewriter.evaluate((root) => {
          const us = Array.from(root.querySelectorAll(".bta-u"));
          return (
            us.length > 0 &&
            us.every((u) => getComputedStyle(u).visibility === "visible")
          );
        }),
      { timeout: 6_000 },
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/text-animation-presentation.png",
  });

  // 정리: 북 삭제
  await page.goto(`/books/${bookId}`);
  await page.getByRole("button", { name: "삭제" }).first().click();
  await page.getByRole("button", { name: /^삭제/ }).last().click();
  await page.waitForURL(/\/books(\?|$)/, { timeout: 15_000 });
});
