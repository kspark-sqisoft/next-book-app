// 자막 글자 크기 — 슬라이드 단위로 정하고 배율을 곱한다 (모바일에서 다른 텍스트보다 커지지 않게)
import { describe, expect, it } from "vitest";

import {
  subtitleBottomGapPx,
  subtitleFontPx,
} from "@/features/book/book-video-subtitles";

describe("subtitleFontPx", () => {
  it("기본 슬라이드(960×540)를 배율 1 로 보는 데스크톱에서 예전 크기를 유지한다", () => {
    // 전체 화면 위젯(540): 예전 상한 24 / 34 / 46
    expect(subtitleFontPx("sm", 540, 1)).toBe(24);
    expect(subtitleFontPx("md", 540, 1)).toBe(34);
    expect(subtitleFontPx("lg", 540, 1)).toBe(46);
    // 작은 위젯(200): 예전 비율 구간 16 / 23 / 30 과 거의 같다
    expect(subtitleFontPx("sm", 200, 1)).toBe(16);
    expect(subtitleFontPx("md", 200, 1)).toBe(22);
    expect(subtitleFontPx("lg", 200, 1)).toBe(28);
    // FHD 슬라이드(1080)를 배율 0.5 로 보는 경우도 예전 상한과 같다
    expect(subtitleFontPx("sm", 1080, 0.5)).toBe(24);
    expect(subtitleFontPx("md", 1080, 0.5)).toBe(34);
    expect(subtitleFontPx("lg", 1080, 0.5)).toBe(46);
  });

  it("폰(배율 0.39)에서 전체 화면 위젯의 '크게'가 예전 32px 보다 확실히 작다", () => {
    expect(subtitleFontPx("lg", 540, 0.39)).toBe(18);
    expect(subtitleFontPx("md", 540, 0.39)).toBe(13);
    expect(subtitleFontPx("sm", 540, 0.39)).toBe(9);
  });

  it("배율이 줄면 글자도 같은 비율로 줄어 위젯 대비 크기가 유지된다", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const desktop = subtitleFontPx(size, 540, 1);
      const mobile = subtitleFontPx(size, 540, 0.25);
      // 반올림 순서 차이로 1px 까지 어긋날 수 있다
      expect(Math.abs(mobile - desktop * 0.25)).toBeLessThanOrEqual(1);
    }
  });

  it("모르는 값·비정상 입력은 sm 으로, 크기는 1px 이상", () => {
    expect(subtitleFontPx(undefined, 540, 1)).toBe(24);
    expect(subtitleFontPx("xl", 540, 1)).toBe(24);
    expect(subtitleFontPx("sm", Number.NaN, 1)).toBe(16);
    expect(subtitleFontPx("sm", 540, 0)).toBe(1);
  });
});

describe("subtitleBottomGapPx", () => {
  it("위젯 높이의 7%, 슬라이드 단위 최소 16px 에 배율을 곱한다", () => {
    expect(subtitleBottomGapPx(540, 1)).toBe(38);
    expect(subtitleBottomGapPx(200, 1)).toBe(16);
    expect(subtitleBottomGapPx(540, 0.39)).toBe(15);
  });
});
