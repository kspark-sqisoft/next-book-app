// 자막 글자 크기 — 슬라이드 단위로 정하고 배율을 곱한다 (모바일에서 다른 텍스트보다 커지지 않게)
import { describe, expect, it } from "vitest";

import {
  subtitleBottomGapPx,
  subtitleFontPx,
} from "@/features/book/book-video-subtitles";

describe("subtitleFontPx", () => {
  it("데스크톱 배율(0.5)에서는 기존 화면 크기를 유지한다", () => {
    // 1080 높이 위젯: sm 24 / md 34 / lg 46 (기존 상한)
    expect(subtitleFontPx("sm", 1080, 0.5)).toBe(24);
    expect(subtitleFontPx("md", 1080, 0.5)).toBe(34);
    expect(subtitleFontPx("lg", 1080, 0.5)).toBe(46);
    // 400 높이 위젯: 비율 구간 — 0.08·0.115·0.15 × 200
    expect(subtitleFontPx("sm", 400, 0.5)).toBe(16);
    expect(subtitleFontPx("md", 400, 0.5)).toBe(23);
    expect(subtitleFontPx("lg", 400, 0.5)).toBe(30);
  });

  it("배율이 줄면 글자도 같은 비율로 줄어 위젯 대비 크기가 유지된다", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const desktop = subtitleFontPx(size, 1080, 0.5);
      const mobile = subtitleFontPx(size, 1080, 0.2);
      expect(mobile).toBe(Math.round((desktop / 0.5) * 0.2));
    }
    // 예전 공식은 화면 px 하한(15px)이 걸려 작은 위젯에서도 커졌다 — 이제는 배율을 따른다
    expect(subtitleFontPx("lg", 400, 0.2)).toBeLessThan(15);
  });

  it("모르는 값·비정상 입력은 sm 으로, 크기는 1px 이상", () => {
    expect(subtitleFontPx(undefined, 1080, 0.5)).toBe(24);
    expect(subtitleFontPx("xl", 1080, 0.5)).toBe(24);
    expect(subtitleFontPx("sm", Number.NaN, 0.5)).toBeGreaterThanOrEqual(1);
    expect(subtitleFontPx("sm", 1080, 0)).toBe(1);
  });
});

describe("subtitleBottomGapPx", () => {
  it("위젯 높이의 7%, 슬라이드 단위 최소 32px 에 배율을 곱한다", () => {
    expect(subtitleBottomGapPx(1080, 0.5)).toBe(38);
    expect(subtitleBottomGapPx(200, 0.5)).toBe(16);
    expect(subtitleBottomGapPx(200, 0.2)).toBe(6);
  });
});
