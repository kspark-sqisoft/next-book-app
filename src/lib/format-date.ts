/** 글 목록·댓글 등(중간 길이 날짜) */
export function formatDateMediumShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** 글 상세 상단(전체 날짜) */
export function formatDateFullShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
