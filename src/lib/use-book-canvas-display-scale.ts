import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useReducer,
  useState,
  type WheelEvent,
} from "react";

const MIN_USER_ZOOM = 0.25;
const MAX_USER_ZOOM = 4;

/** 슬라이드를 뷰포트 안에 넣는 방식(미리보기 전체 화면 등). */
export type BookCanvasDisplayFitMode = "contain" | "cover" | "fill";

/**
 * 편집·작성자 상세 스테이지 옵션. `BookDetailPage`·`BookEditorPage`에서 쓰이며,
 * contain으로 슬라이드 전체가 보이게 하고, 맞춤 계산용 추가 패딩은 0(가장자리 여백은 래퍼 `p-2` 등 CSS).
 * 좌우 패널을 접으면 중앙 열이 넓어지고 ResizeObserver로 맞춤 배율이 갱신됨.
 */
export const BOOK_CANVAS_STAGE_DISPLAY_OPTS = {
  bottomPad: 0,
  horizontalPad: 0,
  /** 뷰포트가 슬라이드보다 클 때 확대 상한(과도한 픽셀 밀도 방지). */
  maxFitScale: 64,
  fitMode: "contain" as const,
} as const;

/**
 * 슬라이드쇰 미리보기 전용: 헤더 아래 북 영역을 가장자리까지 쓰도록 패딩 0, 논리 1:1 상한 없음(`maxFitScale` 큼).
 */
export const BOOK_CANVAS_PRESENTATION_DISPLAY_OPTS = {
  bottomPad: 0,
  symmetricVerticalPad: 0,
  horizontalPad: 0,
  maxFitScale: 24,
} as const;

/**
 * ResizeObserver로 맞춤 비율(fit)을 구하고, 사용자 배율(zoom)을 곱해 캔버스에 넘길 display scale을 만듭니다.
 */
export function useBookCanvasDisplayScale(
  wrapRef: RefObject<HTMLElement | null>,
  opts: {
    slideWidth: number;
    slideHeight: number;
    /**
     * 세로 맞춤에서만 아래쪽으로 빼는 값(에디터 스테이지).
     * `symmetricVerticalPad`가 있으면 세로는 `height - 2 * symmetricVerticalPad`만 사용.
     */
    bottomPad: number;
    /** 상·하 동일 여백(px)을 맞춤 계산에 반영(미리보기 등) */
    symmetricVerticalPad?: number;
    /** 좌우 여백 합에 가깝게 빼는 값(기본 48). 미리보기 등에서 작게 줄여 슬라이드를 크게 맞춤 */
    horizontalPad?: number;
    /**
     * 맞춤 배율 상한(기본 1). 미리보기에서 뷰포트가 슬라이드 논리 크기보다 크면 1 초과로 확대해 화면을 채움.
     */
    maxFitScale?: number;
    /**
     * contain: 전체가 보이도록 축소(여백 가능). cover: 뷰를 덮도록 확대(잘림). fill: 비율 무시로 뷰를 꽉 채움(추가 CSS 스케일).
     */
    fitMode?: BookCanvasDisplayFitMode;
  },
) {
  const {
    slideWidth,
    slideHeight,
    bottomPad,
    symmetricVerticalPad,
    horizontalPad = 48,
    maxFitScale = 1,
    fitMode = "contain",
  } = opts;
  const [fitScale, setFitScale] = useState(0.55);
  const [zoomMul, setZoomMul] = useState(1);
  const [, bumpFitLayout] = useReducer((n: number) => n + 1, 0);
  const [layoutAvail, setLayoutAvail] = useState({ w: 0, h: 0 });

  const measureFitScale = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const cr = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pl = Number.parseFloat(cs.paddingLeft) || 0;
    const pr = Number.parseFloat(cs.paddingRight) || 0;
    const pt = Number.parseFloat(cs.paddingTop) || 0;
    const pb = Number.parseFloat(cs.paddingBottom) || 0;
    const contentW = Math.max(0, el.clientWidth - pl - pr);
    const contentH = Math.max(0, el.clientHeight - pt - pb);
    const boxW = contentW > 0 ? contentW : cr.width;
    const boxH = contentH > 0 ? contentH : cr.height;
    const verticalDeduction =
      symmetricVerticalPad != null ? 2 * symmetricVerticalPad : bottomPad;
    const availW = Math.max(1, boxW - horizontalPad);
    const availH = Math.max(1, boxH - verticalDeduction);
    const sx = availW / slideWidth;
    const sy = availH / slideHeight;
    const base = fitMode === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
    const s = Math.max(0.22, Math.min(base, maxFitScale));
    setFitScale(s);
    setLayoutAvail({ w: availW, h: availH });
  }, [
    wrapRef,
    slideWidth,
    slideHeight,
    bottomPad,
    symmetricVerticalPad,
    horizontalPad,
    maxFitScale,
    fitMode,
  ]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    /* 초기 측정만 microtask로 분리 — effect 본문 동기 setState 린트 회피 */
    queueMicrotask(() => {
      measureFitScale();
    });
    const ro = new ResizeObserver(() => measureFitScale());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureFitScale, wrapRef]);

  const displayScale = fitScale * zoomMul;

  const zoomIn = useCallback(
    () =>
      setZoomMul((z) =>
        Math.min(MAX_USER_ZOOM, Math.round(z * 1.15 * 1000) / 1000),
      ),
    [],
  );
  const zoomOut = useCallback(
    () =>
      setZoomMul((z) =>
        Math.max(MIN_USER_ZOOM, Math.round((z / 1.15) * 1000) / 1000),
      ),
    [],
  );
  /** 100% 배율 + 맞춤 비율 재계산. 동일 수치여도 리렌더해 미리보기 등에서 버튼이 무반응처럼 보이지 않게 함 */
  const zoomReset = useCallback(() => {
    setZoomMul(1);
    queueMicrotask(() => {
      measureFitScale();
      bumpFitLayout();
    });
  }, [measureFitScale]);

  const zoomPercent = Math.round(zoomMul * 100);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY > 0) zoomOut();
      else zoomIn();
    },
    [zoomIn, zoomOut],
  );

  return {
    displayScale,
    zoomPercent,
    zoomIn,
    zoomOut,
    zoomReset,
    handleWheel,
    layoutAvail,
    fitMode,
  };
}
