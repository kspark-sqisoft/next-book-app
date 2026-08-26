// 섹션(메뉴) 아이콘 — 사이드바와 같은 아이콘·같은 포인트 컬러를 페이지 안에서도 쓴다.
import { CRETA_SECTIONS, type CretaSectionKey } from "@/lib/creta-sections";
import { cn } from "@/lib/utils";

/** 페이지 제목 옆에 놓는 크기 */
export function CretaSectionIcon({
  section,
  className,
}: {
  section: CretaSectionKey;
  className?: string;
}) {
  const { icon: Icon, iconClass } = CRETA_SECTIONS[section];
  return (
    <Icon className={cn("size-5 shrink-0", iconClass, className)} aria-hidden />
  );
}

/**
 * 비어 있는 목록 카드 안에 놓는 아이콘.
 * 원래 글자만 있던 자리라 색이 경쟁할 대상이 없다 — 조금 크게, 살짝 흐리게.
 */
export function CretaEmptyStateIcon({
  section,
  className,
}: {
  section: CretaSectionKey;
  className?: string;
}) {
  return (
    <CretaSectionIcon
      section={section}
      className={cn("mx-auto mb-3 size-8 opacity-80", className)}
    />
  );
}
