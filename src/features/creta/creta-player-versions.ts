// 크레타 플레이어 버전 목록(시뮬레이션) — 실제 플레이어가 없어 버전은 상수 목록으로 흉내낸다.
// 서버 검증(허용 버전인지)과 디바이스 상세의 버전 콤보박스가 같은 목록을 쓴다.
// 순수 모듈이라 서버·클라이언트 어디서든 import 할 수 있다.

/** 선택 가능한 플레이어 버전 — 최신이 맨 앞(내림차순) */
export const CRETA_PLAYER_VERSIONS = [
  "v1.2.0",
  "v1.1.0",
  "v1.0.3",
  "v1.0.0",
] as const;

export type CretaPlayerVersion = (typeof CRETA_PLAYER_VERSIONS)[number];

/** 플레이어 최신 버전 — 이보다 낮으면 상세에 "구버전" 배지 표시 */
export const CRETA_PLAYER_LATEST: CretaPlayerVersion = CRETA_PLAYER_VERSIONS[0];

/** 목록에 있는 버전 문자열인지(서버 입력 검증용) */
export function isCretaPlayerVersion(v: unknown): v is CretaPlayerVersion {
  return (
    typeof v === "string" &&
    (CRETA_PLAYER_VERSIONS as readonly string[]).includes(v)
  );
}

/** "v1.2.0" → [1, 2, 0]. 숫자가 아닌 조각은 0 */
function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(".")
    .map((p) => {
      const n = Number.parseInt(p, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

/** 숫자 단위 버전 비교 — a > b 면 양수, 같으면 0, a < b 면 음수 */
export function comparePlayerVersion(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
