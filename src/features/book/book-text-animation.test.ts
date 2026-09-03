// 텍스트 위젯 애니메이션 순수 로직 검증 — 식별자 정규화·시간 클램프·글자/단어 분할·스태거 변수
import { describe, expect, it } from "vitest";

import {
  BOOK_TEXT_ANIMATION_IDS,
  BOOK_TEXT_ANIMATION_META,
  BOOK_TEXT_ANIMATION_OPTIONS,
  buildAnimatedTextHtml,
  clampBookTextAnimationDurationSec,
  normalizeBookTextAnimation,
  resolveBookTextAnimation,
  textAnimationCssVars,
} from "@/features/book/book-text-animation";

describe("normalizeBookTextAnimation", () => {
  it("알 수 없는 값·빈 값은 none", () => {
    expect(normalizeBookTextAnimation(undefined)).toBe("none");
    expect(normalizeBookTextAnimation("")).toBe("none");
    expect(normalizeBookTextAnimation("blink")).toBe("none");
    expect(normalizeBookTextAnimation(42)).toBe("none");
  });
  it("허용 식별자는 그대로(공백 제거)", () => {
    for (const id of BOOK_TEXT_ANIMATION_IDS) {
      expect(normalizeBookTextAnimation(` ${id} `)).toBe(id);
    }
  });
  it("옵션 목록·메타는 식별자 전부를 다룬다", () => {
    expect(BOOK_TEXT_ANIMATION_OPTIONS.map((o) => o.id)).toEqual([
      ...BOOK_TEXT_ANIMATION_IDS,
    ]);
    for (const id of BOOK_TEXT_ANIMATION_IDS) {
      expect(BOOK_TEXT_ANIMATION_META[id]).toBeDefined();
    }
  });
});

describe("clampBookTextAnimationDurationSec", () => {
  it("없으면 효과별 기본값", () => {
    expect(clampBookTextAnimationDurationSec(undefined, "fadeIn")).toBe(
      BOOK_TEXT_ANIMATION_META.fadeIn.defaultDurationSec,
    );
    expect(clampBookTextAnimationDurationSec(NaN, "marquee")).toBe(
      BOOK_TEXT_ANIMATION_META.marquee.defaultDurationSec,
    );
  });
  it("0.2~120 범위로 자른다", () => {
    expect(clampBookTextAnimationDurationSec(0, "fadeIn")).toBe(0.2);
    expect(clampBookTextAnimationDurationSec(999, "fadeIn")).toBe(120);
    expect(clampBookTextAnimationDurationSec(2.5, "fadeIn")).toBe(2.5);
    expect(clampBookTextAnimationDurationSec("3", "fadeIn")).toBe(3);
  });
});

describe("resolveBookTextAnimation", () => {
  it("요소에서 효과·시간을 읽고 none이면 시간도 0", () => {
    expect(resolveBookTextAnimation({})).toEqual({
      id: "none",
      durationSec: 0,
    });
    expect(
      resolveBookTextAnimation({
        textAnimation: "typewriter",
        textAnimationDurationSec: 4,
      }),
    ).toEqual({ id: "typewriter", durationSec: 4 });
    expect(resolveBookTextAnimation({ textAnimation: "wave" })).toEqual({
      id: "wave",
      durationSec: BOOK_TEXT_ANIMATION_META.wave.defaultDurationSec,
    });
  });
});

describe("buildAnimatedTextHtml — 글자 단위", () => {
  it("텍스트 노드만 span으로 감싸고 서식 태그는 유지한다", () => {
    const { html, count } = buildAnimatedTextHtml(
      "<p>ab <strong>c</strong></p>",
      "char",
    );
    expect(count).toBe(3);
    // 공백은 그대로(줄바꿈 보존), 영문 단어는 nowrap 래퍼로 묶임
    expect(html).toContain("<strong>");
    expect(html).toMatch(
      /<span class="bta-w"><span class="bta-u" style="--i:0">a<\/span><span class="bta-u" style="--i:1">b<\/span><\/span> <strong><span class="bta-u" style="--i:2">c<\/span><\/strong>/,
    );
  });
  it("한글·CJK는 글자마다 개별(줄바꿈 자유), 이모지는 한 글자", () => {
    const { html, count } = buildAnimatedTextHtml("<p>안녕 👋🏽</p>", "char");
    expect(count).toBe(3);
    // 한글은 단어 래퍼 없이 바로 글자 span
    expect(html).not.toContain("bta-w");
    expect(html).toContain('style="--i:2">👋🏽</span>');
  });
  it("여러 문단은 문서 순서대로 번호가 이어진다", () => {
    const { html, count } = buildAnimatedTextHtml(
      "<p>가</p><p>나다</p>",
      "char",
    );
    expect(count).toBe(3);
    expect(html).toContain('style="--i:0">가');
    expect(html).toContain('style="--i:2">다');
  });
  it("문자열 내용은 이스케이프된 채 유지된다(XSS 없음)", () => {
    const { html } = buildAnimatedTextHtml("<p>a&lt;b&gt;</p>", "char");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;");
  });
  it("단위가 너무 많으면 분할하지 않고 count=0(블록 폴백)", () => {
    const long = "가".repeat(5000);
    const { html, count } = buildAnimatedTextHtml(`<p>${long}</p>`, "char");
    expect(count).toBe(0);
    expect(html).toBe(`<p>${long}</p>`);
  });
});

describe("buildAnimatedTextHtml — 단어 단위", () => {
  it("공백으로 나뉜 단어마다 하나의 span, 서식 안쪽도 분할", () => {
    const { html, count } = buildAnimatedTextHtml(
      "<p>hello 세상 <em>x y</em></p>",
      "word",
    );
    expect(count).toBe(4);
    expect(html).toContain('<span class="bta-u" style="--i:0">hello</span>');
    expect(html).toContain('<span class="bta-u" style="--i:1">세상</span>');
    expect(html).toContain('<em><span class="bta-u" style="--i:2">x</span> ');
  });
});

describe("textAnimationCssVars", () => {
  it("블록 효과는 총 시간만", () => {
    expect(textAnimationCssVars("fadeIn", 1.5, 0)).toEqual({
      "--bta-dur": "1.5s",
    });
  });
  it("타이프라이터: 글자 수로 나눈 간격, 총합 ≈ 시간", () => {
    const v = textAnimationCssVars("typewriter", 3, 30);
    expect(v["--bta-step"]).toBe("0.1s");
    expect(v["--bta-unit"]).toBe("0.1s");
  });
  it("팝·단어 페이드: 단위 길이를 뺀 나머지를 균등 분배", () => {
    const unit = BOOK_TEXT_ANIMATION_META.charPop.unitDurationSec;
    const v = textAnimationCssVars("charPop", 2, 11);
    expect(v["--bta-unit"]).toBe(`${unit}s`);
    expect(parseFloat(v["--bta-step"]!)).toBeCloseTo((2 - unit) / 10, 4);
  });
  it("시간이 단위 길이보다 짧아도 음수 간격이 되지 않는다", () => {
    const v = textAnimationCssVars("charPop", 0.2, 50);
    expect(parseFloat(v["--bta-step"]!)).toBeGreaterThanOrEqual(0);
  });
  it("웨이브: 사이클 시간 + 고정 위상 간격", () => {
    const v = textAnimationCssVars("wave", 2, 10);
    expect(v["--bta-dur"]).toBe("2s");
    expect(v["--bta-step"]).toBe(
      `${BOOK_TEXT_ANIMATION_META.wave.unitDurationSec}s`,
    );
  });
  it("글자 수 0이면 0으로 나누지 않는다", () => {
    const v = textAnimationCssVars("typewriter", 3, 0);
    expect(v["--bta-step"]).toBe("3s");
  });
});
