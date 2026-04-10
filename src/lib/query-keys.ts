// TanStack Query 키 — invalidateQueries 시 문자열 일치가 전제
export const userKeys = {
  all: ["users"] as const,
  me: () => [...userKeys.all, "me"] as const,
  adminList: () => [...userKeys.all, "admin", "list", "v3"] as const, // 스키마 버전 bump 시 v4 등으로
};

export const bookKeys = {
  all: ["books"] as const,
  lists: () => [...bookKeys.all, "list"] as const,
  list: (search: string) => [...bookKeys.lists(), search] as const, // 검색어 포함
  details: () => [...bookKeys.all, "detail"] as const,
  detail: (id: number) => [...bookKeys.details(), id] as const,
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
