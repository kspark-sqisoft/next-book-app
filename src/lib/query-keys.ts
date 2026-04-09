/**
 * TanStack Query 키 — 게시글·댓글·사용자 캐시 무효화·공유 시 동일 문자열을 쓰기 위함.
 */
export const userKeys = {
  all: ["users"] as const,
  me: () => [...userKeys.all, "me"] as const,
  /** 응답에 imageUrl 등 스키마가 바뀌면 세그먼트를 올려 캐시 무효화 */
  adminList: () => [...userKeys.all, "admin", "list", "v3"] as const,
};

export const bookKeys = {
  all: ["books"] as const,
  lists: () => [...bookKeys.all, "list"] as const,
  list: (search: string) => [...bookKeys.lists(), search] as const,
  details: () => [...bookKeys.all, "detail"] as const,
  detail: (id: number) => [...bookKeys.details(), id] as const,
};

export const catKeys = {
  all: ["cats"] as const,
  lists: () => [...catKeys.all, "list"] as const,
  list: () => [...catKeys.lists()] as const,
  details: () => [...catKeys.all, "detail"] as const,
  detail: (id: number) => [...catKeys.details(), id] as const,
};

export const postKeys = {
  all: ["posts"] as const,
  lists: () => [...postKeys.all, "list"] as const,
  /** `category` 빈 문자열 = 전체 */
  list: (search: string, category: string) =>
    [...postKeys.lists(), search, category] as const,
  details: () => [...postKeys.all, "detail"] as const,
  /** `viewerKey`: 로그인 시 likedByMe 등이 바뀌므로 구분 */
  detail: (id: number, viewerKey: number | "anon") =>
    [...postKeys.details(), id, viewerKey] as const,
  comments: (postId: number) => [...postKeys.all, postId, "comments"] as const,
};
