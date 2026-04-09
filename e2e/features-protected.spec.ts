import { expect, test } from "@playwright/test";

/** ProtectedRoute — 비로그인 시 로그인으로 리다이렉트 */
test("/me 는 비로그인 시 로그인으로 보낸다", async ({ page }) => {
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login\?from=/);
});

test("/posts/new 는 비로그인 시 로그인으로 보낸다", async ({ page }) => {
  await page.goto("/posts/new");
  await expect(page).toHaveURL(/\/login\?from=/);
});

test("/books/new 는 비로그인 시 로그인으로 보낸다", async ({ page }) => {
  await page.goto("/books/new");
  await expect(page).toHaveURL(/\/login\?from=/);
});
