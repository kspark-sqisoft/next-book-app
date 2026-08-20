/** 북 생성·수정 시 페이지 한 줄 */
export type BookPageInputDto = {
  sortOrder: number;
  name?: string;
  backgroundColor?: string;
  elements?: unknown[];
  presentationTimingElementId?: string | null;
  presentationTransition?: string;
  presentationTransitionMs?: number;
  /** false면 미리보기 재생 목록에서 제외(기본 true) */
  presentationVisible?: boolean;
};

export type CreateBookDto = {
  title: string;
  slideWidth?: number;
  slideHeight?: number;
  pages?: BookPageInputDto[];
  presentationLoop?: boolean;
};

export type UpdateBookDto = {
  title?: string;
  slideWidth?: number;
  slideHeight?: number;
  pages?: BookPageInputDto[];
  presentationLoop?: boolean;
};
