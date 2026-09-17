import { describe, expect, it } from "vitest";

import {
  comparePlayerVersion,
  CRETA_PLAYER_LATEST,
  CRETA_PLAYER_VERSIONS,
  isCretaPlayerVersion,
} from "@/features/creta/creta-player-versions";

describe("크레타 플레이어 버전 목록(시뮬레이션)", () => {
  it("최신 버전은 목록의 첫 항목이며 목록은 최신순으로 정렬돼 있다", () => {
    expect(CRETA_PLAYER_LATEST).toBe(CRETA_PLAYER_VERSIONS[0]);
    for (let i = 1; i < CRETA_PLAYER_VERSIONS.length; i++) {
      expect(
        comparePlayerVersion(
          CRETA_PLAYER_VERSIONS[i - 1]!,
          CRETA_PLAYER_VERSIONS[i]!,
        ),
      ).toBeGreaterThan(0);
    }
  });

  it("DB 기본값 v1.1.0 은 선택 가능한 버전에 포함된다", () => {
    expect(isCretaPlayerVersion("v1.1.0")).toBe(true);
  });

  it("목록에 없는 값·문자열이 아닌 값은 거부한다", () => {
    expect(isCretaPlayerVersion("v9.9.9")).toBe(false);
    expect(isCretaPlayerVersion("1.2.0")).toBe(false);
    expect(isCretaPlayerVersion("")).toBe(false);
    expect(isCretaPlayerVersion(null)).toBe(false);
    expect(isCretaPlayerVersion(120)).toBe(false);
  });

  it("버전 비교는 숫자 단위로 한다(문자열 비교가 아님)", () => {
    expect(comparePlayerVersion("v1.10.0", "v1.9.0")).toBeGreaterThan(0);
    expect(comparePlayerVersion("v1.2.0", "v1.2.0")).toBe(0);
    expect(comparePlayerVersion("v1.0.0", "v1.0.3")).toBeLessThan(0);
  });
});
