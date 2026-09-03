/**
 * 날짜 표시·정렬 헬퍼.
 *
 * 같은 필드가 경로에 따라 다른 런타임 타입으로 도착한다. 서버 액션은 React Flight가
 * `Date`를 왕복 보존하므로(`"$D"+toJSON()` → `new Date(...)`) Date 인스턴스가 오고,
 * axios(JSON)를 거치는 경로는 ISO 문자열이 온다. 그래서 입력 타입은 `DateLike`다 —
 * 한쪽으로 단정하면 다른 경로에서 어긋난다.
 */
export type DateLike = string | Date;

/**
 * 정렬용 타임스탬프. `a < b` 로 직접 비교하면 안 된다 —
 * Date와 문자열을 섞으면 관계 비교가 양방향 모두 **false**가 되어(ISO 문자열의
 * ToNumber가 NaN) 정렬이 오류 없이 무의미해진다. 지금은 두 경로가 우연히 모두
 * Date라 동작하지만, 한쪽이 문자열이 되는 순간 조용히 틀린다.
 */
export function toTimestamp(value: DateLike | null | undefined): number {
  if (value == null) return 0;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// ISO 문자열·Date → ko-KR 로케일 표시(파싱 실패 시 원문 반환)
export function formatDateMediumShort(value: DateLike): string {
  try {
    return new Date(value).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value);
  }
}

export function formatDateFullShort(value: DateLike): string {
  try {
    return new Date(value).toLocaleString("ko-KR", {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return String(value);
  }
}
