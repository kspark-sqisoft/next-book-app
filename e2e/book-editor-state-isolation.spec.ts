import { expect, test } from "@playwright/test";

import { loginUser, signupUser } from "./helpers/auth";

/**
 * 에디터 UI 상태를 zustand 스토어로 옮기면서 생긴 위험을 고정한다.
 *
 * 이전에는 슬라이드 위치·선택이 화면별 `useState` 였고 부모가 `key={book.id}` 로
 * 리마운트해 자동으로 비워졌다. 스토어는 모듈 수명이라 그렇지 않다 — 초기화하지 않으면
 * **A 북에서 보던 슬라이드가 B 북에 그대로 이어진다.** 사용자에게는 "다른 북을 열었는데
 * 3번 슬라이드가 열려 있다"로 보인다. 로그아웃 시 쿼리 캐시를 비우지 않아 이전 사용자
 * 데이터가 보이던 사고(dbfc322)와 같은 종류다.
 *
 * **반드시 클라이언트 라우팅으로 이동해야 한다.** `page.goto()` 는 문서를 새로 불러와
 * 모듈 스토어가 다시 만들어지므로, 초기화를 빼도 테스트가 통과해 버린다(실제로 확인했다).
 * 그래서 링크 클릭으로만 화면을 옮긴다.
 */
test("다른 북을 열면 앞 북의 슬라이드 위치가 이어지지 않는다", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const email = `e2e-iso-${Date.now()}@example.com`;
  await signupUser(request, { email, name: "E2E 상태격리" });
  await loginUser(page, email);

  /** 북을 만들고 슬라이드 두 장으로 만든 뒤 URL 을 돌려준다 */
  async function createBookWithTwoSlides(title: string): Promise<string> {
    await page.goto("/books/new");
    const titleInput = page.getByPlaceholder("북 제목");
    await titleInput.waitFor({ timeout: 25_000 });
    await titleInput.fill(title);
    await page.getByRole("button", { name: "저장" }).click();
    await page.waitForURL(/\/books\/\d+$/, { timeout: 25_000 });

    await page.getByRole("button", { name: "페이지 추가" }).first().click();
    await expect(
      page.getByRole("button", { name: "슬라이드 2", exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    // 저장하지 않으면 다시 열었을 때 슬라이드가 한 장뿐이라 검증이 성립하지 않는다
    const url = page.url();
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("저장했습니다.")).toBeVisible({
      timeout: 25_000,
    });
    return url;
  }

  const bookA = await createBookWithTwoSlides(`격리A ${Date.now()}`);
  const bookB = await createBookWithTwoSlides(`격리B ${Date.now()}`);

  // 목록에서 출발해 **링크 클릭으로만** 오간다(문서를 새로 불러오면 스토어가 재생성된다)
  const idA = bookA.split("/").pop();
  const idB = bookB.split("/").pop();

  await page.goto("/books");
  await page.locator(`a[href="/books/${idA}"]`).first().click();
  await page.waitForURL(new RegExp(`/books/${idA}$`), { timeout: 25_000 });

  const slide2 = page.getByRole("button", { name: "슬라이드 2", exact: true });
  await slide2.waitFor({ timeout: 25_000 });
  await slide2.click();
  await expect(page.locator('button[aria-current="true"]')).toContainText(
    "슬라이드 2",
    { timeout: 15_000 },
  );

  // 목록으로 되돌아간 뒤(클라이언트 라우팅) B 를 연다
  await page.getByRole("button", { name: "뒤로 가기" }).click();
  await page.waitForURL(/\/books$/, { timeout: 20_000 });
  await page.locator(`a[href="/books/${idB}"]`).first().click();
  await page.waitForURL(new RegExp(`/books/${idB}$`), { timeout: 25_000 });

  // B 는 첫 슬라이드여야 한다 — 이어지면 스토어 초기화가 빠진 것이다
  await page
    .locator('button[aria-current="true"]')
    .first()
    .waitFor({ timeout: 25_000 });
  await expect(page.locator('button[aria-current="true"]')).toContainText(
    "슬라이드 1",
  );
});
