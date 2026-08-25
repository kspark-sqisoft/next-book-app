// TanStack Query 키 — invalidateQueries 시 문자열 일치가 전제
export const userKeys = {
  all: ["users"] as const,
  me: () => [...userKeys.all, "me"] as const,
  adminList: () => [...userKeys.all, "admin", "list", "v3"] as const, // 스키마 버전 bump 시 v4 등으로
};

export const orgKeys = {
  all: ["orgs"] as const,
  capabilities: () => [...orgKeys.all, "capabilities"] as const,
  list: () => [...orgKeys.all, "list"] as const,
  members: (orgId: number) => [...orgKeys.all, "members", orgId] as const,
};

export const bookKeys = {
  all: ["books"] as const,
  lists: () => [...bookKeys.all, "list"] as const,
  list: (search: string) => [...bookKeys.lists(), search] as const, // 검색어 포함
  details: () => [...bookKeys.all, "detail"] as const,
  detail: (id: number) => [...bookKeys.details(), id] as const,
  /** 북 미디어 라이브러리(서버 보관 목록 + 공유받은 파일) */
  mediaLibrary: (id: number) => [...bookKeys.all, "media-library", id] as const,
};

// Cats React Query 계층: invalidateQueries({ queryKey: catKeys.all })로 일괄 무효화
export const catKeys = {
  all: ["cats"] as const, // 고양이 도메인 루트
  lists: () => [...catKeys.all, "list"] as const, // 목록 계열
  list: () => [...catKeys.lists()] as const, // 단일 목록 쿼리 키
  details: () => [...catKeys.all, "detail"] as const, // 상세 계열
  detail: (id: number) => [...catKeys.details(), id] as const, // id별 상세
};

export const postKeys = {
  all: ["posts"] as const,
  lists: () => [...postKeys.all, "list"] as const,
  list: (search: string, category: string) =>
    [...postKeys.lists(), search, category] as const, // category "" = 전체
  details: () => [...postKeys.all, "detail"] as const,
  detail: (id: number, viewerKey: number | "anon") =>
    [...postKeys.details(), id, viewerKey] as const, // 로그인 여부에 따라 상세 필드가 달라짐
  comments: (postId: number) => [...postKeys.all, postId, "comments"] as const,
};

// 크레타 사이니지(플레이리스트·스케줄·디바이스)
export const cretaKeys = {
  all: ["creta"] as const,
  playlists: () => [...cretaKeys.all, "playlists"] as const,
  playlist: (id: number) => [...cretaKeys.all, "playlist", id] as const,
  schedules: () => [...cretaKeys.all, "schedules"] as const,
  schedule: (id: number) => [...cretaKeys.all, "schedule", id] as const,
  devices: () => [...cretaKeys.all, "devices"] as const,
  device: (id: number) => [...cretaKeys.all, "device", id] as const,
  /** 긴급 알림(활성 1건) — 디바이스 화면들이 폴링 */
  alert: () => [...cretaKeys.all, "alert"] as const,
  /** 재생 리포트(Proof-of-Play) — 기간(일)별 */
  playReport: (rangeDays: number) =>
    [...cretaKeys.all, "play-report", rangeDays] as const,
  /** 크레타 > 계정: 내가 만든/공유받은 북·플레이리스트·스케줄 */
  overview: (userId: number) => [...cretaKeys.all, "overview", userId] as const,
  /** 커뮤니티 댓글 */
  comments: (kind: string, targetId: number) =>
    [...cretaKeys.all, "comments", kind, targetId] as const,
  commentCounts: (kind: string, ids: readonly number[]) =>
    [...cretaKeys.all, "comment-counts", kind, ids.join(",")] as const,
  /** 커뮤니티 좋아요(개수 + 내가 눌렀는지 — viewer별) */
  likes: (kind: string, ids: readonly number[], viewer: number | "anon") =>
    [...cretaKeys.all, "likes", kind, ids.join(","), viewer] as const,
};
