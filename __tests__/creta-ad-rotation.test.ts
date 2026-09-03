import { describe, expect, it } from "vitest";

import {
  buildCretaAdRotation,
  cretaAdRotationIndex,
} from "@/features/creta/creta-ad-rotation";
import type { CretaAdActiveCreative } from "@/features/creta/creta-ads-api";

function creative(
  id: number,
  campaignId: number,
  weight: number,
): CretaAdActiveCreative {
  return {
    id,
    campaignId,
    campaignName: `캠페인 ${campaignId}`,
    name: `소재 ${id}`,
    kind: "image",
    src: `/uploads/book-images/${id}.jpg`,
    status: "approved",
    weight,
  };
}

describe("buildCretaAdRotation", () => {
  it("소재가 없으면 빈 로테이션을 준다", () => {
    expect(buildCretaAdRotation([])).toEqual([]);
  });

  it("가중치만큼 로테이션에 투입한다", () => {
    // Arrange — 가중치 3짜리 캠페인 하나
    const creatives = [creative(1, 10, 3)];

    // Act
    const rotation = buildCretaAdRotation(creatives);

    // Assert
    expect(rotation).toHaveLength(3);
    expect(rotation.every((c) => c.id === 1)).toBe(true);
  });

  it("가중치 비율이 로테이션 점유율에 반영된다", () => {
    const rotation = buildCretaAdRotation([
      creative(1, 10, 3),
      creative(2, 20, 1),
    ]);

    expect(rotation).toHaveLength(4);
    expect(rotation.filter((c) => c.campaignId === 10)).toHaveLength(3);
    expect(rotation.filter((c) => c.campaignId === 20)).toHaveLength(1);
  });

  it("같은 캠페인 소재가 연달아 나오지 않게 섞는다", () => {
    // 가중치가 같은 두 캠페인이면 라운드로빈으로 번갈아 나와야 한다
    const rotation = buildCretaAdRotation([
      creative(1, 10, 2),
      creative(2, 20, 2),
    ]);

    expect(rotation).toHaveLength(4);
    const campaigns = rotation.map((c) => c.campaignId);
    for (let i = 1; i < campaigns.length; i += 1) {
      expect(campaigns[i]).not.toBe(campaigns[i - 1]);
    }
  });

  it("가중치가 0이나 음수여도 최소 1회는 투입한다", () => {
    const rotation = buildCretaAdRotation([creative(1, 10, 0)]);
    expect(rotation).toHaveLength(1);
  });
});

describe("cretaAdRotationIndex", () => {
  it("로테이션이 비면 0을 준다(나머지 연산 0 나누기 방지)", () => {
    expect(cretaAdRotationIndex(0, 15)).toBe(0);
  });

  it("항상 로테이션 길이 안의 순번을 준다", () => {
    for (const len of [1, 3, 7]) {
      const idx = cretaAdRotationIndex(len, 15);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(len);
    }
  });

  it("표시 시간이 0이어도 나눗셈이 깨지지 않는다", () => {
    const idx = cretaAdRotationIndex(4, 0);
    expect(Number.isInteger(idx)).toBe(true);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(4);
  });
});
