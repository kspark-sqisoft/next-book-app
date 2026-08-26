import { type Browser, expect, type Page, test } from "@playwright/test";

import { signupUser } from "./helpers/auth";

/**
 * 플레이리스트·스케줄 소유자/공유: 만든 사람이 소유자, "공유"로 회원을 고르면 그 회원은 편집 가능,
 * 공유받지 않은 회원은 편집이 거부된다(보기 전용). 목록 카드에 작성자·공유 대상이 보인다.
 */
const PASSWORD = "e2e-pass-123!";

async function signup(
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
  email: string,
  name: string,
) {
  await signupUser(request, { email, password: PASSWORD, name });
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/me$/, { timeout: 15_000 });
}

/** 로그인 상태가 하이드레이트된 뒤 생성 버튼을 눌러 다이얼로그를 연다(너무 빠른 클릭은 "로그인 필요" 토스트로 빠짐) */
async function openCreateDialog(page: Page, buttonName: string) {
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: buttonName }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  return page.getByRole("dialog");
}

async function loginNewContext(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email);
  return { ctx, page };
}

test("플레이리스트·스케줄 소유자 공유", async ({ browser, page, request }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const owner = {
    email: `e2e-cs-owner-${stamp}@example.com`,
    name: "E2E 소유자",
  };
  const guest = {
    email: `e2e-cs-guest-${stamp}@example.com`,
    name: `E2E 공유대상 ${stamp}`,
  };
  const other = {
    email: `e2e-cs-other-${stamp}@example.com`,
    name: "E2E 무관",
  };
  await signup(request, owner.email, owner.name);
  await signup(request, guest.email, guest.name);
  await signup(request, other.email, other.name);

  // ── 플레이리스트: 소유자 생성 → 공유 ──
  await login(page, owner.email);
  await page.goto("/playlists");
  const plDialog = await openCreateDialog(page, "새 플레이리스트");
  const plName = `E2E 공유 PL ${stamp}`;
  await plDialog.getByLabel("이름", { exact: true }).fill(plName);
  await plDialog.getByRole("button", { name: "만들기" }).click();
  await page.waitForURL(/\/playlists\/\d+$/, { timeout: 20_000 });
  const playlistUrl = page.url();
  await expect(page.getByText(`작성자 ${owner.name}`)).toBeVisible();

  await page.getByRole("button", { name: /^공유/ }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("회원 검색").fill(String(stamp));
  const plRow = dialog.getByRole("checkbox", { name: new RegExp(guest.name) });
  await plRow.click();
  await expect(plRow).toHaveAttribute("aria-checked", "true", {
    timeout: 10_000,
  });
  // 공유 UI는 팝오버(닫기 버튼 없음) — Escape로 닫는다
  await page.keyboard.press("Escape");
  await expect(page.getByText(`${guest.name}에게 공유됨`)).toBeVisible();

  // 목록 카드: 작성자 + 공유 대상
  await page.goto("/playlists");
  const plCard = page
    .locator("[data-slot=card]")
    .filter({ hasText: plName })
    .first();
  await expect(plCard.getByText(`작성자 ${owner.name}`)).toBeVisible({
    timeout: 15_000,
  });
  await expect(plCard.getByText(`${guest.name}에게 공유됨`)).toBeVisible();

  // ── 스케줄: 소유자 생성 → 공유 ──
  await page.goto("/schedules");
  const scDialog = await openCreateDialog(page, "새 스케줄");
  const scName = `E2E 공유 SC ${stamp}`;
  await scDialog.getByLabel("이름", { exact: true }).fill(scName);
  await scDialog.getByRole("button", { name: "만들기" }).click();
  await page.waitForURL(/\/schedules\/\d+$/, { timeout: 20_000 });
  const scheduleUrl = page.url();
  await page.getByRole("button", { name: /^공유/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("회원 검색").fill(String(stamp));
  const scRow = dialog.getByRole("checkbox", { name: new RegExp(guest.name) });
  await scRow.click();
  await expect(scRow).toHaveAttribute("aria-checked", "true", {
    timeout: 10_000,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByText(`${guest.name}에게 공유됨`)).toBeVisible();

  // ── 공유받은 회원: 편집 가능(스케줄 자동 적용 토글 성공), 공유 버튼은 없음 ──
  const g = await loginNewContext(browser, guest.email);
  await g.page.goto(scheduleUrl);
  await expect(g.page.getByText("보기 전용")).toHaveCount(0);
  await expect(g.page.getByRole("button", { name: /^공유/ })).toHaveCount(0);
  const sw = g.page.getByRole("switch", { name: "스케줄 자동 적용" });
  const before = await sw.getAttribute("aria-checked");
  await sw.click();
  await expect(sw).toHaveAttribute(
    "aria-checked",
    before === "true" ? "false" : "true",
    {
      timeout: 10_000,
    },
  );
  await g.page.goto(playlistUrl);
  await expect(g.page.getByText("보기 전용")).toHaveCount(0);
  await g.ctx.close();

  // ── 무관한 회원: 보기 전용, 서버도 거부 ──
  const o = await loginNewContext(browser, other.email);
  await o.page.goto(scheduleUrl);
  await expect(o.page.getByText("보기 전용")).toBeVisible({ timeout: 15_000 });
  await o.page.getByRole("switch", { name: "스케줄 자동 적용" }).click();
  await expect(o.page.getByText("편집 권한이 없습니다")).toBeVisible({
    timeout: 10_000,
  });
  await o.page.goto("/schedules");
  await expect(
    o.page.getByRole("button", { name: `${scName} 삭제` }),
  ).toHaveCount(0);
  await o.ctx.close();

  // ── 정리: 소유자가 삭제 ──
  await page.goto("/schedules");
  await page.getByRole("button", { name: `${scName} 삭제` }).click();
  await page.getByRole("button", { name: /^삭제/ }).last().click();
  await expect(page.getByText(scName)).toHaveCount(0, { timeout: 15_000 });
  await page.goto("/playlists");
  await page.getByRole("button", { name: `${plName} 삭제` }).click();
  await page.getByRole("button", { name: /^삭제/ }).last().click();
  await expect(page.getByText(plName)).toHaveCount(0, { timeout: 15_000 });
});
