import { expect, test } from "@playwright/test";

/** 홈·글·북·Cats 공개 페이지 로드 (인증 불필요) */
test("홈이 로드된다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
});

test("글 목록 페이지", async ({ page }) => {
  await page.goto("/posts");
  await expect(
    page.getByRole("heading", { name: "글 목록", level: 1 }),
  ).toBeVisible();
});

test("북 목록 페이지", async ({ page }) => {
  await page.goto("/books");
  await expect(
    page.getByRole("heading", { name: "북", level: 1 }),
  ).toBeVisible();
});

test("Cats 학습 페이지", async ({ page }) => {
  await page.goto("/cats");
  await expect(
    page.getByRole("heading", { name: "Cats (학습)", level: 1 }),
  ).toBeVisible();
});
