// HTTP Range 헤더 파싱 (RFC 9110 단일 bytes 구간)
// - 반환 null: Range 없음/해석 불가 형식 → 전체 응답(200)으로 폴백
// - 반환 "invalid": 만족 불가 구간 → 416 응답 대상
export type ByteRange = { start: number; end: number };

export function parseByteRange(
  header: string | null,
  size: number,
): ByteRange | "invalid" | null {
  if (!header) return null;
  // 단일 구간만 지원. 다중 구간(bytes=0-1,5-9) 등은 폴백(전체 응답) — 스펙상 Range 무시 허용.
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    // 접미 구간(bytes=-N): 마지막 N바이트
    const suffix = Number(m[2]);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}
