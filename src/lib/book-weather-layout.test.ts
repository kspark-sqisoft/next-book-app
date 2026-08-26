// 날씨 위젯 배치 속성 정규화 — 알 수 없는 값은 auto, 블록 순서는 항상 5개 순열
import { describe, expect, it } from "vitest";

import {
  BOOK_WEATHER_BLOCK_KEYS,
  BOOK_WEATHER_LAYOUT_OPTIONS,
  BOOK_WEATHER_LAYOUT_VALUES,
  resolveBookWeatherBlockOrder,
  resolveBookWeatherLayout,
} from "@/lib/book-canvas";

describe("resolveBookWeatherLayout", () => {
  it("columns·single·row는 그대로, 나머지는 auto", () => {
    expect(resolveBookWeatherLayout("columns")).toBe("columns");
    expect(resolveBookWeatherLayout("single")).toBe("single");
    expect(resolveBookWeatherLayout("row")).toBe("row");
    expect(resolveBookWeatherLayout("auto")).toBe("auto");
    expect(resolveBookWeatherLayout(undefined)).toBe("auto");
    expect(resolveBookWeatherLayout("rows")).toBe("auto");
    expect(resolveBookWeatherLayout(1)).toBe("auto");
  });
  it("옵션 목록은 허용 값 전부를 다룬다", () => {
    expect(BOOK_WEATHER_LAYOUT_OPTIONS.map((o) => o.id)).toEqual([
      ...BOOK_WEATHER_LAYOUT_VALUES,
    ]);
  });
});

describe("resolveBookWeatherBlockOrder", () => {
  it("생략·비정상은 기본 순서 전체", () => {
    expect(resolveBookWeatherBlockOrder(undefined)).toEqual([
      ...BOOK_WEATHER_BLOCK_KEYS,
    ]);
    expect(resolveBookWeatherBlockOrder("main")).toEqual([
      ...BOOK_WEATHER_BLOCK_KEYS,
    ]);
  });
  it("유효 키를 앞에 두고 빠진 키를 기본 순서로 채운다", () => {
    expect(resolveBookWeatherBlockOrder(["time", "main"])).toEqual([
      "time",
      "main",
      "location",
      "air",
      "secondary",
    ]);
  });
  it("중복·알 수 없는 키는 무시", () => {
    expect(
      resolveBookWeatherBlockOrder(["air", "air", "bogus", "location"]),
    ).toEqual(["air", "location", "main", "time", "secondary"]);
  });
});
