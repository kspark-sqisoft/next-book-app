// DB·API에 저장되는 카테고리 id (서버 normalize와 동일 순서 유지)
export const POST_CATEGORY_VALUES = [
  "tech",
  "life",
  "study",
  "chat",
  "general",
] as const;

export type PostCategoryId = (typeof POST_CATEGORY_VALUES)[number];

export function isPostCategoryId(s: string): s is PostCategoryId {
  return (POST_CATEGORY_VALUES as readonly string[]).includes(s);
}

// UI 한글 라벨
export const POST_CATEGORY_LABELS: Record<PostCategoryId, string> = {
  tech: "기술",
  life: "일상",
  study: "학습",
  chat: "잡담",
  general: "일반",
};
