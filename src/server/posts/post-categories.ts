/** 글 카테고리(시드·필터·작성 시 공통) */
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

export function normalizePostCategory(
  raw: string | undefined | null,
): PostCategoryId {
  const t = raw?.trim().toLowerCase();
  if (t && isPostCategoryId(t)) return t;
  return "general";
}

export function randomPostCategory(): PostCategoryId {
  const i = Math.floor(Math.random() * POST_CATEGORY_VALUES.length);
  return POST_CATEGORY_VALUES[i]!;
}
