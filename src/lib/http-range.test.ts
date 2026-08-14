import { describe, expect, it } from "vitest";

import { parseByteRange } from "./http-range";

describe("parseByteRange", () => {
  it("헤더가 없으면 null(전체 응답 폴백)", () => {
    expect(parseByteRange(null, 100)).toBeNull();
  });

  it("일반 구간 bytes=0-499", () => {
    expect(parseByteRange("bytes=0-499", 1000)).toEqual({ start: 0, end: 499 });
  });

  it("끝 생략 bytes=500- 은 파일 끝까지", () => {
    expect(parseByteRange("bytes=500-", 1000)).toEqual({
      start: 500,
      end: 999,
    });
  });

  it("접미 구간 bytes=-300 은 마지막 300바이트", () => {
    expect(parseByteRange("bytes=-300", 1000)).toEqual({
      start: 700,
      end: 999,
    });
  });

  it("파일 크기보다 큰 접미 구간은 전체로 클램프", () => {
    expect(parseByteRange("bytes=-5000", 1000)).toEqual({ start: 0, end: 999 });
  });

  it("end가 파일 끝을 넘으면 클램프", () => {
    expect(parseByteRange("bytes=900-2000", 1000)).toEqual({
      start: 900,
      end: 999,
    });
  });

  it("start가 파일 크기 이상이면 invalid(416)", () => {
    expect(parseByteRange("bytes=1000-", 1000)).toBe("invalid");
  });

  it("start > end 이면 invalid(416)", () => {
    expect(parseByteRange("bytes=500-100", 1000)).toBe("invalid");
  });

  it("bytes=-0 은 invalid(416)", () => {
    expect(parseByteRange("bytes=-0", 1000)).toBe("invalid");
  });

  it("다중 구간은 null(전체 응답 폴백)", () => {
    expect(parseByteRange("bytes=0-1,5-9", 1000)).toBeNull();
  });

  it("bytes 외 단위·형식 오류는 null(전체 응답 폴백)", () => {
    expect(parseByteRange("items=0-10", 1000)).toBeNull();
    expect(parseByteRange("bytes=-", 1000)).toBeNull();
    expect(parseByteRange("bytes=abc-def", 1000)).toBeNull();
  });

  it("빈 파일에 대한 구간 요청은 invalid(416)", () => {
    expect(parseByteRange("bytes=0-", 0)).toBe("invalid");
  });
});
