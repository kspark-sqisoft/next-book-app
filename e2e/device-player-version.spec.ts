import { expect, test } from "@playwright/test";

import { loginUser, signupUser } from "./helpers/auth";

/**
 * 디바이스 상세 — 플레이어 버전 콤보박스(시뮬레이션).
 * 새 디바이스는 v1.1.0(구버전)으로 등록되며, 콤보박스에서 과거·최신 버전을 골라 지정할 수 있다.
 */
test.describe("디바이스 상세 플레이어 버전 선택", () => {
  test("콤보박스로 과거 버전·최신 버전을 지정하면 배지와 표시가 바뀐다", async ({
    page,
    request,
  }) => {
    const email = `e2e-player-${Date.now()}@example.com`;
    await signupUser(request, { email, name: "플레이어 버전 테스터" });
    await loginUser(page, email);

    // 디바이스 등록
    const deviceName = `버전 테스트 ${Date.now()}`;
    await page.goto("/devices");
    await page.getByRole("button", { name: "디바이스 등록" }).click();
    await page.getByLabel("이름").fill(deviceName);
    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expect(
      page.getByText(`「${deviceName}」을(를) 등록했습니다.`),
    ).toBeVisible();

    // 상세로 이동
    await page
      .getByRole("link", { name: new RegExp(deviceName) })
      .first()
      .click();
    await page.waitForURL(/\/devices\/\d+$/);

    const trigger = page.getByRole("combobox", { name: "플레이어 버전" });
    await expect(trigger).toContainText("Creta Player v1.1.0");
    await expect(page.getByText("구버전", { exact: true })).toBeVisible();

    // 과거 버전으로 다운그레이드
    await trigger.click();
    const listbox = page.getByRole("listbox");
    await expect(listbox.getByRole("option")).toHaveCount(4);
    await expect(
      listbox.getByRole("option", { name: "Creta Player v1.2.0 (최신)" }),
    ).toBeVisible();
    await listbox.getByRole("option", { name: "Creta Player v1.0.0" }).click();
    await expect(
      page.getByText(
        "플레이어를 Creta Player v1.0.0(으)로 다운그레이드했습니다.",
      ),
    ).toBeVisible();
    await expect(trigger).toContainText("Creta Player v1.0.0");
    await expect(page.getByText("구버전", { exact: true })).toBeVisible();

    // 최신 버전으로 업데이트
    await trigger.click();
    await page
      .getByRole("listbox")
      .getByRole("option", { name: "Creta Player v1.2.0 (최신)" })
      .click();
    await expect(
      page.getByText("플레이어를 Creta Player v1.2.0(으)로 업데이트했습니다."),
    ).toBeVisible();
    await expect(trigger).toContainText("Creta Player v1.2.0");
    await expect(page.getByText("최신", { exact: true })).toBeVisible();

    // 새로고침 후에도 DB에 저장된 버전이 유지된다
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "플레이어 버전" }),
    ).toContainText("Creta Player v1.2.0");
  });
});
