import { describe, expect, it } from "vitest";

import {
  type DateLike,
  formatDateMediumShort,
  toTimestamp,
} from "@/lib/format-date";

/**
 * 같은 필드가 경로에 따라 다른 런타임 타입으로 온다. 서버 액션은 React Flight가
 * Date를 왕복 보존하고, axios(JSON) 경로는 ISO 문자열이다.
 *
 * 커뮤니티 갤러리는 북과 플레이리스트를 한 목록으로 합쳐 정렬한다. 지금은 두 경로가
 * 모두 서버 액션이라 우연히 둘 다 Date이고 `a < b`가 동작하지만, 타입 선언은 string
 * 이었다(이중 캐스팅이 가려 준 거짓말). 한쪽이 문자열이 되는 순간 이 비교는 양방향
 * 모두 false가 되어 정렬이 오류 없이 무의미해진다. 그 조합을 여기서 고정한다.
 */
describe("toTimestamp", () => {
  const iso = "2026-09-03T10:00:00.000Z";

  it("문자열과 Date를 같은 값으로 환산한다", () => {
    expect(toTimestamp(iso)).toBe(toTimestamp(new Date(iso)));
  });

  it("null·undefined·잘못된 값은 0 — 정렬이 NaN으로 무너지지 않게", () => {
    expect(toTimestamp(null)).toBe(0);
    expect(toTimestamp(undefined)).toBe(0);
    expect(toTimestamp("날짜 아님")).toBe(0);
    expect(toTimestamp(new Date("날짜 아님"))).toBe(0);
  });

  it("Date와 문자열을 섞어도 최신순 정렬이 성립한다 (회귀 고정)", () => {
    const items: { name: string; updatedAt: DateLike }[] = [
      { name: "북-2026-01", updatedAt: "2026-01-01T00:00:00.000Z" },
      { name: "북-2026-08", updatedAt: "2026-08-01T00:00:00.000Z" },
      {
        name: "플레이리스트-2026-09",
        updatedAt: new Date("2026-09-03T10:00:00Z"),
      },
      {
        name: "플레이리스트-2020",
        updatedAt: new Date("2020-01-01T00:00:00Z"),
      },
    ];
    const sorted = [...items]
      .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
      .map((x) => x.name);

    expect(sorted).toEqual([
      "플레이리스트-2026-09",
      "북-2026-08",
      "북-2026-01",
      "플레이리스트-2020",
    ]);
  });

  it("Date와 문자열을 섞으면 관계 비교가 양방향 모두 false — 이 테스트의 존재 이유", () => {
    const d = new Date("2026-09-03T10:00:00Z");
    const s = "2026-01-01T00:00:00.000Z";
    // 타입을 단일 출처로 모은 뒤로는 TS가 이 비교를 컴파일 단계에서 막는다(TS2365).
    // 여기서는 "막지 못했을 때 런타임이 어떻게 되는지"를 남기려는 것이므로 일부러 통과시킨다.
    const lt = (a: unknown, b: unknown) =>
      (a as number) < (b as number) === true;
    expect(lt(d, s)).toBe(false);
    expect(lt(s, d)).toBe(false);
  });
});

describe("formatDateMediumShort", () => {
  it("문자열과 Date가 같은 표시를 낸다", () => {
    const iso = "2026-09-03T10:00:00.000Z";
    expect(formatDateMediumShort(iso)).toBe(
      formatDateMediumShort(new Date(iso)),
    );
  });
});
