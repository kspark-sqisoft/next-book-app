// 날씨 위젯 배치 속성 정규화 — 알 수 없는 값은 auto
import { describe, expect, it } from "vitest";

import {
  BOOK_WEATHER_LAYOUT_OPTIONS,
  BOOK_WEATHER_LAYOUT_VALUES,
  resolveBookWeatherLayout,
} from "@/lib/book-canvas";

describe("resolveBookWeatherLayout", () => {
  it("columns·single은 그대로, 나머지는 auto", () => {
    expect(resolveBookWeatherLayout("columns")).toBe("columns");
    expect(resolveBookWeatherLayout("single")).toBe("single");
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
