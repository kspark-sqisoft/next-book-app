// 에디터 전역 단축키가 텍스트 입력·오버레이 UI 조작을 방해하지 않게 하는 공용 가드.
// 같은 로직이 페이지·캔버스 4곳에 복제되어 있었음 — 새 입력 컴포넌트가 생기면 여기만 고친다.

const EDITABLE_SELECTOR = "input, textarea, [contenteditable=true]";
const OVERLAY_SELECTOR =
  '[data-slot="select-content"], [data-slot="combobox-content"], [data-slot="combobox-list"]';

/** 이벤트 대상이 텍스트 입력 중이거나 셀렉트류 오버레이 내부면 true(단축키 무시 대상) */
export function isBookEditorTypingTarget(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  if (!t || typeof t.closest !== "function") return false;
  return !!t.closest(`${EDITABLE_SELECTOR}, ${OVERLAY_SELECTOR}`);
}
