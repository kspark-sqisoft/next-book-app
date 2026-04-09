import { type BookCanvasElement } from "@/lib/book-canvas";

/**
 * `public/cards/` 샘플 사진 — `BOOK_TEMPLATE_STOCK_IMAGE_PATHS` 경로와 파일명이 맞아야 합니다.
 * Pexels(무료 API)로 채우려면: `frontend/.env.local`에 `PEXELS_API_KEY=` 후 `npm run fetch:cards`
 * (스크립트: `scripts/fetch-template-card-images.mjs`, 출처: `public/cards/ATTRIBUTION.txt`).
 * 파일이 없으면 캔버스에서 회색 플레이스홀더로 보입니다.
 */
export const BOOK_TEMPLATE_STOCK_IMAGE_PATHS: readonly string[] = [
  "/cards/img1.jpg",
  "/cards/img2.jpg",
  "/cards/img3.jpg",
  "/cards/img4.jpg",
  "/cards/img5.jpg",
  "/cards/img6.jpg",
  "/cards/img7.jpg",
  "/cards/img8.jpg",
  "/cards/img9.jpg",
  "/cards/img10.jpg",
];

/** 디지털 사이니지·키오스크용 템플릿 묶음 */
export type BookSlideTemplateCategoryId = "menu" | "notice" | "life" | "news" | "visual";

export type BookSlideTemplateCategoryDef = {
  id: BookSlideTemplateCategoryId;
  name: string;
  description: string;
};

export const BOOK_SLIDE_TEMPLATE_CATEGORIES: BookSlideTemplateCategoryDef[] = [
  {
    id: "menu",
    name: "메뉴보드·프로모",
    description: "가격표·세트 행사·메뉴 사진 배치",
  },
  {
    id: "notice",
    name: "공지·안내",
    description: "운영 안내·휴무·주의사항·문의",
  },
  {
    id: "life",
    name: "실생활·현장",
    description: "Wi-Fi·화장실·층 안내·행사·매장 등 바로 쓰는 패널",
  },
  {
    id: "news",
    name: "뉴스·정보",
    description: "속보·피처 기사·다중 단신",
  },
  {
    id: "visual",
    name: "비주얼·캠페인",
    description: "히어로 이미지·브랜드·스토리 레이아웃",
  },
];

export type BookSlideTemplateId =
  | "menuBoard"
  | "menuCafeBoard"
  | "menuRowPhotos"
  | "promoCombo"
  | "menuPriceBoard"
  | "menuQuadGrid"
  | "menuStackedPhotos"
  | "noticeBoard"
  | "noticeWeeklyHours"
  | "noticeEmergency"
  | "noticeParkingInfo"
  | "lifeWifiGuest"
  | "lifeRestroom"
  | "lifeFloorDirectory"
  | "lifeSafetyHygiene"
  | "lifeLostFound"
  | "lifeTodaySchedule"
  | "lifeWelcomeDesk"
  | "lifeMeetingRoom"
  | "lifeStorefront"
  | "lifeEventGate"
  | "newsFlash"
  | "newsFeature"
  | "newsDual"
  | "newsTriptych"
  | "newsBulletin"
  | "newsPhotoSide"
  | "photoHero"
  | "editorialSplit"
  | "coverPhoto"
  | "visualFilmRow"
  | "visualMosaicL"
  | "visualTypoCenter"
  | "visualMagazineTop";

export type BookSlideTemplateDef = {
  id: BookSlideTemplateId;
  categoryId: BookSlideTemplateCategoryId;
  name: string;
  description: string;
};

/** 미리보기 카드용(0~100%, 슬라이드 논리 비율과 동일하게 잡음) */
export type BookSlideTemplatePreviewLayer =
  | {
      kind: "image";
      leftPct: number;
      topPct: number;
      widthPct: number;
      heightPct: number;
      stockIndex: number;
      radiusPx?: number;
    }
  | {
      kind: "text";
      leftPct: number;
      topPct: number;
      widthPct: number;
      heightPct: number;
      tone: "title" | "body" | "caption";
    }
  | {
      kind: "accent";
      leftPct: number;
      topPct: number;
      widthPct: number;
      heightPct: number;
      /** 공지 강조 등 */
      variant: "alert";
    };

export function getBookSlideTemplatePreviewLayers(
  templateId: BookSlideTemplateId,
): BookSlideTemplatePreviewLayer[] {
  switch (templateId) {
    case "menuBoard":
      return [
        { kind: "text", leftPct: 8, topPct: 4, widthPct: 84, heightPct: 11, tone: "title" },
        { kind: "text", leftPct: 5, topPct: 17, widthPct: 43, heightPct: 76, tone: "body" },
        { kind: "text", leftPct: 52, topPct: 17, widthPct: 43, heightPct: 76, tone: "body" },
      ];
    case "menuCafeBoard":
      return [
        { kind: "image", leftPct: 4, topPct: 8, widthPct: 38, heightPct: 84, stockIndex: 2, radiusPx: 4 },
        { kind: "text", leftPct: 46, topPct: 6, widthPct: 50, heightPct: 9, tone: "title" },
        { kind: "text", leftPct: 46, topPct: 17, widthPct: 50, heightPct: 11, tone: "title" },
        { kind: "text", leftPct: 46, topPct: 30, widthPct: 50, heightPct: 66, tone: "body" },
      ];
    case "menuRowPhotos":
      return [
        { kind: "image", leftPct: 5, topPct: 9, widthPct: 28.67, heightPct: 38, stockIndex: 3, radiusPx: 2 },
        {
          kind: "image",
          leftPct: 35.67,
          topPct: 9,
          widthPct: 28.67,
          heightPct: 38,
          stockIndex: 4,
          radiusPx: 2,
        },
        {
          kind: "image",
          leftPct: 66.33,
          topPct: 9,
          widthPct: 28.67,
          heightPct: 38,
          stockIndex: 5,
          radiusPx: 2,
        },
        { kind: "text", leftPct: 5, topPct: 51, widthPct: 90, heightPct: 12, tone: "body" },
        { kind: "text", leftPct: 5, topPct: 66, widthPct: 90, heightPct: 22, tone: "caption" },
      ];
    case "promoCombo":
      return [
        { kind: "image", leftPct: 4, topPct: 6, widthPct: 48, heightPct: 88, stockIndex: 7, radiusPx: 3 },
        { kind: "text", leftPct: 56, topPct: 10, widthPct: 40, heightPct: 12, tone: "title" },
        { kind: "text", leftPct: 56, topPct: 26, widthPct: 40, heightPct: 16, tone: "title" },
        { kind: "text", leftPct: 56, topPct: 46, widthPct: 40, heightPct: 44, tone: "body" },
      ];
    case "menuPriceBoard":
      return [
        { kind: "text", leftPct: 10, topPct: 6, widthPct: 80, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 18, topPct: 20, widthPct: 64, heightPct: 62, tone: "body" },
        { kind: "text", leftPct: 10, topPct: 86, widthPct: 80, heightPct: 8, tone: "caption" },
      ];
    case "menuQuadGrid":
      return [
        { kind: "text", leftPct: 5, topPct: 3, widthPct: 90, heightPct: 8, tone: "title" },
        { kind: "image", leftPct: 6, topPct: 13, widthPct: 43, heightPct: 32, stockIndex: 0, radiusPx: 4 },
        { kind: "image", leftPct: 51, topPct: 13, widthPct: 43, heightPct: 32, stockIndex: 1, radiusPx: 4 },
        { kind: "image", leftPct: 6, topPct: 47, widthPct: 43, heightPct: 32, stockIndex: 2, radiusPx: 4 },
        { kind: "image", leftPct: 51, topPct: 47, widthPct: 43, heightPct: 32, stockIndex: 3, radiusPx: 4 },
        { kind: "text", leftPct: 5, topPct: 82, widthPct: 90, heightPct: 14, tone: "caption" },
      ];
    case "menuStackedPhotos":
      return [
        { kind: "text", leftPct: 38, topPct: 5, widthPct: 57, heightPct: 10, tone: "title" },
        { kind: "image", leftPct: 5, topPct: 5, widthPct: 30, heightPct: 26, stockIndex: 4, radiusPx: 4 },
        { kind: "image", leftPct: 5, topPct: 34, widthPct: 30, heightPct: 26, stockIndex: 5, radiusPx: 4 },
        { kind: "image", leftPct: 5, topPct: 63, widthPct: 30, heightPct: 26, stockIndex: 6, radiusPx: 4 },
        { kind: "text", leftPct: 38, topPct: 17, widthPct: 57, heightPct: 72, tone: "body" },
      ];
    case "noticeBoard":
      return [
        { kind: "accent", leftPct: 0, topPct: 0, widthPct: 100, heightPct: 12, variant: "alert" },
        { kind: "text", leftPct: 4, topPct: 3, widthPct: 92, heightPct: 7, tone: "title" },
        { kind: "text", leftPct: 5, topPct: 16, widthPct: 90, heightPct: 58, tone: "body" },
        { kind: "text", leftPct: 5, topPct: 78, widthPct: 90, heightPct: 12, tone: "caption" },
      ];
    case "noticeWeeklyHours":
      return [
        { kind: "text", leftPct: 6, topPct: 6, widthPct: 88, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 8, topPct: 20, widthPct: 84, heightPct: 68, tone: "body" },
        { kind: "text", leftPct: 6, topPct: 90, widthPct: 88, heightPct: 7, tone: "caption" },
      ];
    case "noticeEmergency":
      return [
        { kind: "accent", leftPct: 0, topPct: 0, widthPct: 100, heightPct: 11, variant: "alert" },
        { kind: "text", leftPct: 5, topPct: 3, widthPct: 90, heightPct: 7, tone: "title" },
        { kind: "text", leftPct: 6, topPct: 15, widthPct: 88, heightPct: 55, tone: "body" },
        { kind: "text", leftPct: 6, topPct: 74, widthPct: 88, heightPct: 20, tone: "caption" },
      ];
    case "noticeParkingInfo":
      return [
        { kind: "text", leftPct: 6, topPct: 5, widthPct: 88, heightPct: 11, tone: "title" },
        { kind: "text", leftPct: 8, topPct: 19, widthPct: 84, heightPct: 52, tone: "body" },
        { kind: "text", leftPct: 6, topPct: 76, widthPct: 88, heightPct: 18, tone: "caption" },
      ];
    case "lifeWifiGuest":
      return [
        { kind: "text", leftPct: 8, topPct: 8, widthPct: 84, heightPct: 12, tone: "title" },
        { kind: "text", leftPct: 10, topPct: 24, widthPct: 80, heightPct: 48, tone: "body" },
        { kind: "text", leftPct: 8, topPct: 76, widthPct: 84, heightPct: 16, tone: "caption" },
      ];
    case "lifeRestroom":
      return [
        { kind: "text", leftPct: 8, topPct: 6, widthPct: 84, heightPct: 11, tone: "title" },
        { kind: "text", leftPct: 10, topPct: 20, widthPct: 80, heightPct: 58, tone: "body" },
        { kind: "text", leftPct: 8, topPct: 82, widthPct: 84, heightPct: 12, tone: "caption" },
      ];
    case "lifeFloorDirectory":
      return [
        { kind: "text", leftPct: 6, topPct: 5, widthPct: 88, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 5, topPct: 18, widthPct: 28, heightPct: 72, tone: "body" },
        { kind: "text", leftPct: 36, topPct: 18, widthPct: 28, heightPct: 72, tone: "body" },
        { kind: "text", leftPct: 67, topPct: 18, widthPct: 28, heightPct: 72, tone: "body" },
      ];
    case "lifeSafetyHygiene":
      return [
        { kind: "accent", leftPct: 0, topPct: 0, widthPct: 100, heightPct: 10, variant: "alert" },
        { kind: "text", leftPct: 5, topPct: 3, widthPct: 90, heightPct: 6, tone: "title" },
        { kind: "text", leftPct: 7, topPct: 14, widthPct: 86, heightPct: 68, tone: "body" },
        { kind: "text", leftPct: 6, topPct: 86, widthPct: 88, heightPct: 10, tone: "caption" },
      ];
    case "lifeLostFound":
      return [
        { kind: "text", leftPct: 8, topPct: 7, widthPct: 84, heightPct: 11, tone: "title" },
        { kind: "text", leftPct: 10, topPct: 22, widthPct: 80, heightPct: 52, tone: "body" },
        { kind: "text", leftPct: 8, topPct: 78, widthPct: 84, heightPct: 16, tone: "caption" },
      ];
    case "lifeTodaySchedule":
      return [
        { kind: "text", leftPct: 6, topPct: 5, widthPct: 88, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 8, topPct: 18, widthPct: 84, heightPct: 72, tone: "body" },
        { kind: "text", leftPct: 6, topPct: 92, widthPct: 88, heightPct: 6, tone: "caption" },
      ];
    case "lifeWelcomeDesk":
      return [
        { kind: "image", leftPct: 6, topPct: 10, widthPct: 32, heightPct: 55, stockIndex: 0, radiusPx: 4 },
        { kind: "text", leftPct: 42, topPct: 10, widthPct: 52, heightPct: 14, tone: "title" },
        { kind: "text", leftPct: 42, topPct: 26, widthPct: 52, heightPct: 52, tone: "body" },
        { kind: "text", leftPct: 6, topPct: 82, widthPct: 88, heightPct: 12, tone: "caption" },
      ];
    case "lifeMeetingRoom":
      return [
        { kind: "accent", leftPct: 15, topPct: 8, widthPct: 70, heightPct: 3, variant: "alert" },
        { kind: "text", leftPct: 10, topPct: 14, widthPct: 80, heightPct: 16, tone: "title" },
        { kind: "text", leftPct: 12, topPct: 34, widthPct: 76, heightPct: 22, tone: "body" },
        { kind: "text", leftPct: 12, topPct: 60, widthPct: 76, heightPct: 30, tone: "body" },
      ];
    case "lifeStorefront":
      return [
        { kind: "accent", leftPct: 0, topPct: 0, widthPct: 100, heightPct: 8, variant: "alert" },
        { kind: "text", leftPct: 8, topPct: 12, widthPct: 84, heightPct: 14, tone: "title" },
        { kind: "text", leftPct: 10, topPct: 30, widthPct: 80, heightPct: 50, tone: "body" },
        { kind: "text", leftPct: 8, topPct: 84, widthPct: 84, heightPct: 12, tone: "caption" },
      ];
    case "lifeEventGate":
      return [
        { kind: "text", leftPct: 6, topPct: 6, widthPct: 88, heightPct: 14, tone: "title" },
        { kind: "text", leftPct: 8, topPct: 24, widthPct: 84, heightPct: 56, tone: "body" },
        { kind: "text", leftPct: 6, topPct: 84, widthPct: 88, heightPct: 10, tone: "caption" },
      ];
    case "newsFlash":
      return [
        { kind: "image", leftPct: 5, topPct: 5, widthPct: 90, heightPct: 34, stockIndex: 8, radiusPx: 2 },
        { kind: "text", leftPct: 5, topPct: 42, widthPct: 90, heightPct: 6, tone: "caption" },
        { kind: "text", leftPct: 5, topPct: 50, widthPct: 90, heightPct: 12, tone: "title" },
        { kind: "text", leftPct: 5, topPct: 64, widthPct: 90, heightPct: 28, tone: "body" },
      ];
    case "newsFeature":
      return [
        { kind: "image", leftPct: 5, topPct: 5, widthPct: 90, heightPct: 36, stockIndex: 2, radiusPx: 2 },
        { kind: "text", leftPct: 7, topPct: 44, widthPct: 86, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 7, topPct: 56, widthPct: 86, heightPct: 14, tone: "body" },
        { kind: "text", leftPct: 7, topPct: 73, widthPct: 86, heightPct: 22, tone: "body" },
      ];
    case "newsDual":
      return [
        { kind: "text", leftPct: 5, topPct: 8, widthPct: 43, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 5, topPct: 20, widthPct: 43, heightPct: 68, tone: "body" },
        { kind: "text", leftPct: 52, topPct: 8, widthPct: 43, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 52, topPct: 20, widthPct: 43, heightPct: 68, tone: "body" },
      ];
    case "newsTriptych":
      return [
        { kind: "image", leftPct: 4, topPct: 5, widthPct: 29, heightPct: 30, stockIndex: 6, radiusPx: 3 },
        { kind: "image", leftPct: 35.5, topPct: 5, widthPct: 29, heightPct: 30, stockIndex: 7, radiusPx: 3 },
        { kind: "image", leftPct: 67, topPct: 5, widthPct: 29, heightPct: 30, stockIndex: 8, radiusPx: 3 },
        { kind: "text", leftPct: 4, topPct: 38, widthPct: 29, heightPct: 26, tone: "title" },
        { kind: "text", leftPct: 35.5, topPct: 38, widthPct: 29, heightPct: 26, tone: "body" },
        { kind: "text", leftPct: 67, topPct: 38, widthPct: 29, heightPct: 26, tone: "body" },
        { kind: "text", leftPct: 4, topPct: 68, widthPct: 92, heightPct: 28, tone: "caption" },
      ];
    case "newsBulletin":
      return [
        { kind: "text", leftPct: 5, topPct: 5, widthPct: 90, heightPct: 12, tone: "title" },
        { kind: "text", leftPct: 7, topPct: 20, widthPct: 86, heightPct: 72, tone: "body" },
      ];
    case "newsPhotoSide":
      return [
        { kind: "image", leftPct: 4, topPct: 6, widthPct: 36, heightPct: 88, stockIndex: 9, radiusPx: 4 },
        { kind: "text", leftPct: 44, topPct: 8, widthPct: 52, heightPct: 14, tone: "title" },
        { kind: "text", leftPct: 44, topPct: 25, widthPct: 52, heightPct: 48, tone: "body" },
        { kind: "text", leftPct: 44, topPct: 78, widthPct: 52, heightPct: 14, tone: "caption" },
      ];
    case "photoHero":
      return [
        { kind: "image", leftPct: 0, topPct: 0, widthPct: 100, heightPct: 52, stockIndex: 0, radiusPx: 0 },
        { kind: "text", leftPct: 6, topPct: 56, widthPct: 88, heightPct: 12, tone: "title" },
        { kind: "text", leftPct: 12.5, topPct: 70, widthPct: 75, heightPct: 9, tone: "caption" },
      ];
    case "editorialSplit":
      return [
        { kind: "image", leftPct: 5, topPct: 5, widthPct: 40, heightPct: 90, stockIndex: 1, radiusPx: 3 },
        { kind: "text", leftPct: 50, topPct: 7, widthPct: 45, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 50, topPct: 19, widthPct: 45, heightPct: 52, tone: "body" },
        { kind: "text", leftPct: 50, topPct: 78, widthPct: 45, heightPct: 10, tone: "caption" },
      ];
    case "coverPhoto":
      return [
        { kind: "image", leftPct: 4, topPct: 4, widthPct: 92, heightPct: 72, stockIndex: 6, radiusPx: 3 },
        { kind: "text", leftPct: 4, topPct: 78, widthPct: 92, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 4, topPct: 90, widthPct: 92, heightPct: 7, tone: "caption" },
      ];
    case "visualFilmRow":
      return [
        { kind: "image", leftPct: 3, topPct: 10, widthPct: 22.5, heightPct: 52, stockIndex: 0, radiusPx: 2 },
        { kind: "image", leftPct: 27, topPct: 10, widthPct: 22.5, heightPct: 52, stockIndex: 1, radiusPx: 2 },
        { kind: "image", leftPct: 51, topPct: 10, widthPct: 22.5, heightPct: 52, stockIndex: 2, radiusPx: 2 },
        { kind: "image", leftPct: 75, topPct: 10, widthPct: 22.5, heightPct: 52, stockIndex: 3, radiusPx: 2 },
        { kind: "text", leftPct: 5, topPct: 68, widthPct: 90, heightPct: 12, tone: "title" },
        { kind: "text", leftPct: 8, topPct: 84, widthPct: 84, heightPct: 12, tone: "caption" },
      ];
    case "visualMosaicL":
      return [
        { kind: "image", leftPct: 4, topPct: 5, widthPct: 52, heightPct: 58, stockIndex: 4, radiusPx: 4 },
        { kind: "image", leftPct: 58, topPct: 5, widthPct: 38, heightPct: 27, stockIndex: 5, radiusPx: 3 },
        { kind: "image", leftPct: 58, topPct: 35, widthPct: 38, heightPct: 28, stockIndex: 6, radiusPx: 3 },
        { kind: "text", leftPct: 4, topPct: 68, widthPct: 92, heightPct: 10, tone: "title" },
        { kind: "text", leftPct: 4, topPct: 82, widthPct: 92, heightPct: 14, tone: "body" },
      ];
    case "visualTypoCenter":
      return [
        { kind: "text", leftPct: 8, topPct: 32, widthPct: 84, heightPct: 22, tone: "title" },
        { kind: "text", leftPct: 15, topPct: 58, widthPct: 70, heightPct: 10, tone: "caption" },
        { kind: "text", leftPct: 12, topPct: 72, widthPct: 76, heightPct: 20, tone: "body" },
      ];
    case "visualMagazineTop":
      return [
        { kind: "image", leftPct: 0, topPct: 0, widthPct: 100, heightPct: 38, stockIndex: 7, radiusPx: 0 },
        { kind: "text", leftPct: 5, topPct: 41, widthPct: 90, heightPct: 11, tone: "title" },
        { kind: "text", leftPct: 5, topPct: 54, widthPct: 43, heightPct: 38, tone: "body" },
        { kind: "text", leftPct: 52, topPct: 54, widthPct: 43, heightPct: 38, tone: "body" },
        { kind: "text", leftPct: 5, topPct: 94, widthPct: 90, heightPct: 5, tone: "caption" },
      ];
    default:
      return [];
  }
}

export const BOOK_SLIDE_TEMPLATE_LIST: BookSlideTemplateDef[] = [
  {
    id: "menuBoard",
    categoryId: "menu",
    name: "2열 메뉴판",
    description: "제목 + 좌·우 가격·품목(카페·식당 메뉴보드)",
  },
  {
    id: "menuCafeBoard",
    categoryId: "menu",
    name: "카페 메뉴 보드",
    description: "좌측 시그니처 음료 사진 + 우측 HOT/ICED·가격(매장 전광판)",
  },
  {
    id: "menuRowPhotos",
    categoryId: "menu",
    name: "메뉴 3컷",
    description: "대표 메뉴 사진 세 장 + 가격·설명(디지털 메뉴보드)",
  },
  {
    id: "promoCombo",
    categoryId: "menu",
    name: "프로모·세트",
    description: "큰 음식 사진 + 행사명·가격·조건(기간 한정 안내)",
  },
  {
    id: "menuPriceBoard",
    categoryId: "menu",
    name: "가격표·단일 열",
    description: "중앙 정렬 메뉴명·가격 리스트(간판·키오스크)",
  },
  {
    id: "menuQuadGrid",
    categoryId: "menu",
    name: "메뉴 4컷 그리드",
    description: "2×2 대표 사진 + 상단 제목·하단 안내(베이커리·브런치)",
  },
  {
    id: "menuStackedPhotos",
    categoryId: "menu",
    name: "세로 사진 + 메뉴",
    description: "왼쪽 세로 썸네일 스택 + 오른쪽 풀 텍스트 메뉴",
  },
  {
    id: "noticeBoard",
    categoryId: "notice",
    name: "공지 보드",
    description: "강조 띠 + 본문 + 운영·문의(휴무·이벤트 안내)",
  },
  {
    id: "noticeWeeklyHours",
    categoryId: "notice",
    name: "주간 운영 안내",
    description: "요일별 영업·휴무 블록 + 하단 연락처",
  },
  {
    id: "noticeEmergency",
    categoryId: "notice",
    name: "긴급·임시 안내",
    description: "경고 띠 + 짧은 지시·연락처(설비·날씨·임시 휴무)",
  },
  {
    id: "noticeParkingInfo",
    categoryId: "notice",
    name: "방문·주차 안내",
    description: "제목 + 안내 문구 + 하단 문의(로비·몰 디렉터리)",
  },
  {
    id: "lifeWifiGuest",
    categoryId: "life",
    name: "게스트 Wi-Fi",
    description: "SSID·비밀번호·유의사항(숙소·카페·사무실 로비)",
  },
  {
    id: "lifeRestroom",
    categoryId: "life",
    name: "화장실·동선",
    description: "위치·유아·휠체어·성별 안내(몰·역사·공공시설)",
  },
  {
    id: "lifeFloorDirectory",
    categoryId: "life",
    name: "층별 안내판",
    description: "3열 층·테넌트 요약(오피스·백화점 디렉터리)",
  },
  {
    id: "lifeSafetyHygiene",
    categoryId: "life",
    name: "안전·위생 수칙",
    description: "강조 띠 + 준수 사항(주방·공장·현장·어린이집)",
  },
  {
    id: "lifeLostFound",
    categoryId: "life",
    name: "분실물 센터",
    description: "보관 장소·시간·문의(역·백화점·학교)",
  },
  {
    id: "lifeTodaySchedule",
    categoryId: "life",
    name: "오늘의 일정",
    description: "시간대별 타임라인(학원·병원·행사장 프로그램)",
  },
  {
    id: "lifeWelcomeDesk",
    categoryId: "life",
    name: "리셉션 환영",
    description: "방문 등록·안내 + 대표 이미지(기업·캠퍼스 프론트)",
  },
  {
    id: "lifeMeetingRoom",
    categoryId: "life",
    name: "회의실 도어사인",
    description: "실명·주제·시간·주의(사무실·코워킹)",
  },
  {
    id: "lifeStorefront",
    categoryId: "life",
    name: "매장 영업·프로모",
    description: "OPEN 띠 + 영업시간·할인 한 줄(소매·프랜차이즈)",
  },
  {
    id: "lifeEventGate",
    categoryId: "life",
    name: "행사 입장 안내",
    description: "행사명·게이트·티켓·준수 사항(페스티벌·컨퍼런스)",
  },
  {
    id: "newsFlash",
    categoryId: "news",
    name: "속보",
    description: "사진 + 날짜 라인 + 헤드라인·리드(짧은 뉴스 슬라이드)",
  },
  {
    id: "newsFeature",
    categoryId: "news",
    name: "뉴스 피처",
    description: "와이드 이미지 + 제목·본문·불릿(보도자료형)",
  },
  {
    id: "newsDual",
    categoryId: "news",
    name: "쌍단 신문",
    description: "좌·우 두 건의 단신(정보 패널·로비용)",
  },
  {
    id: "newsTriptych",
    categoryId: "news",
    name: "3단 트립티크",
    description: "사진 세 컷 + 각각 헤드라인·요약(박람회·지역 소식)",
  },
  {
    id: "newsBulletin",
    categoryId: "news",
    name: "게시판·리스트",
    description: "한 줄 헤드라인 + 번호·불릿 다건 요약",
  },
  {
    id: "newsPhotoSide",
    categoryId: "news",
    name: "사진 좌·글 우",
    description: "세로 이미지 + 우측 기사형 본문(인터뷰·현장)",
  },
  {
    id: "photoHero",
    categoryId: "visual",
    name: "캠페인 히어로",
    description: "대형 비주얼 + 캐치카피(브랜드·행사 첫 화면)",
  },
  {
    id: "editorialSplit",
    categoryId: "visual",
    name: "스토리 분할",
    description: "세로 이미지 + 긴 본문(브랜드 스토리·리포트)",
  },
  {
    id: "coverPhoto",
    categoryId: "visual",
    name: "브랜드 표지",
    description: "대형 포토 + 하단 타이틀(시즌·전시 포스터 느낌)",
  },
  {
    id: "visualFilmRow",
    categoryId: "visual",
    name: "필름스트립 4컷",
    description: "가로 동일 비율 네 장 + 하단 타이틀(갤러리·룩북)",
  },
  {
    id: "visualMosaicL",
    categoryId: "visual",
    name: "모자이크 L",
    description: "큰 메인 + 우측 두 컷 + 하단 카피(룩북·여행)",
  },
  {
    id: "visualTypoCenter",
    categoryId: "visual",
    name: "타이포 포스터",
    description: "중앙 대형 한 줄 + 부제·짧은 문구(행사·슬로건)",
  },
  {
    id: "visualMagazineTop",
    categoryId: "visual",
    name: "매거진 상단 화보",
    description: "상단 와이드 이미지 + 헤드라인 + 2열 본문",
  },
];

export function bookSlideTemplatesInCategory(
  categoryId: BookSlideTemplateCategoryId,
): BookSlideTemplateDef[] {
  return BOOK_SLIDE_TEMPLATE_LIST.filter((t) => t.categoryId === categoryId);
}

function stockPath(i: number): string {
  const paths = BOOK_TEMPLATE_STOCK_IMAGE_PATHS;
  return paths[i % paths.length] ?? "/cards/img1.jpg";
}

function newText(
  x: number,
  y: number,
  text: string,
  fontSize: number,
  fill: string,
  width: number,
  height: number,
): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "text",
    x,
    y,
    text,
    fontSize,
    fill,
    width,
    height,
  };
}

function newImage(
  x: number,
  y: number,
  width: number,
  height: number,
  src: string,
  opts?: { borderRadius?: number; objectFit?: "cover" | "contain" },
): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "image",
    x,
    y,
    width,
    height,
    src,
    objectFit: opts?.objectFit ?? "cover",
    ...(opts?.borderRadius != null ? { borderRadius: opts.borderRadius } : {}),
  };
}

/** 현재 슬라이드에 템플릿 요소(텍스트·샘플 이미지)를 추가합니다. 기존 요소는 유지합니다. */
export function instantiateBookSlideTemplate(
  templateId: BookSlideTemplateId,
  pw: number,
  ph: number,
): BookCanvasElement[] {
  const mx = pw / 2;
  const padX = pw * 0.05;
  const padY = ph * 0.05;

  switch (templateId) {
    case "menuBoard": {
      const titleW = pw * 0.72;
      const colW = (pw - padX * 3) / 2;
      const gap = padX;
      const lx = padX;
      const rx = padX + colW + gap;
      const ty = ph * 0.14;
      const ch = ph * 0.76;
      return [
        newText(
          mx - titleW / 2,
          ph * 0.035,
          "오늘의 메뉴",
          Math.round(ph * 0.052),
          "#0f172a",
          titleW,
          ph * 0.1,
        ),
        newText(
          lx,
          ty,
          "COFFEE\n에스프레소 ····· 3,500\n아메리카노 ··· 4,000\n카페 라떼 ···· 4,500\n콜드브루 ······ 4,800",
          Math.round(ph * 0.026),
          "#1e293b",
          colW,
          ch,
        ),
        newText(
          rx,
          ty,
          "FOOD\n샌드위치 세트 · 8,900\n프렌치 프라이 · 3,000\n베이글 + 음료 · 6,500\n\n※ 사진은 참고용입니다.",
          Math.round(ph * 0.026),
          "#1e293b",
          colW,
          ch,
        ),
      ];
    }
    case "menuCafeBoard": {
      const imgW = pw * 0.38;
      const imgH = ph - padY * 2;
      const textX = padX + imgW + pw * 0.035;
      const textW = pw - textX - padX;
      return [
        newImage(padX, padY, imgW, imgH, stockPath(2), { borderRadius: 14, objectFit: "cover" }),
        newText(textX, padY + ph * 0.02, "CAFE MENU", Math.round(ph * 0.03), "#92400e", textW, ph * 0.07),
        newText(
          textX,
          padY + ph * 0.09,
          "오늘의 시그니처",
          Math.round(ph * 0.042),
          "#451a03",
          textW,
          ph * 0.1,
        ),
        newText(
          textX,
          padY + ph * 0.22,
          "HOT\n에스프레소  ·····  3,800\n아메리카노  ·····  4,200\n카페라떼  ·······  4,800\n플랫화이트  ·····  5,200\n\nICED\n아이스아메  ·····  4,500\n콜드브루  ·······  5,000\n자몽에이드  ·····  5,500\n\n※ 샷·시럽 추가 각 500원 · 일부 메뉴 테이크아웃 할인",
          Math.round(ph * 0.024),
          "#292524",
          textW,
          ph * 0.72,
        ),
      ];
    }
    case "menuRowPhotos": {
      const gap = pw * 0.02;
      const thumbW = (pw - padX * 2 - gap * 2) / 3;
      const thumbH = ph * 0.38;
      const topY = padY + ph * 0.04;
      const capW = pw - padX * 2;
      return [
        newImage(padX, topY, thumbW, thumbH, stockPath(3), { borderRadius: 6, objectFit: "cover" }),
        newImage(padX + thumbW + gap, topY, thumbW, thumbH, stockPath(4), {
          borderRadius: 6,
          objectFit: "cover",
        }),
        newImage(padX + (thumbW + gap) * 2, topY, thumbW, thumbH, stockPath(5), {
          borderRadius: 6,
          objectFit: "cover",
        }),
        newText(
          padX,
          topY + thumbH + ph * 0.04,
          "시그니처 A  8,500원  ·  시그니처 B  9,000원  ·  시그니처 C  7,500원",
          Math.round(ph * 0.024),
          "#0f172a",
          capW,
          ph * 0.1,
        ),
        newText(
          padX,
          topY + thumbH + ph * 0.14,
          "원산지·알레르기 정보는 카운터에서 확인하세요.",
          Math.round(ph * 0.022),
          "#64748b",
          capW,
          ph * 0.28,
        ),
      ];
    }
    case "promoCombo": {
      const imgW = pw * 0.5;
      const imgH = ph - padY * 2;
      const tx = padX + imgW + pw * 0.03;
      const tw = pw - tx - padX;
      return [
        newImage(padX, padY, imgW, imgH, stockPath(7), { borderRadius: 14, objectFit: "cover" }),
        newText(tx, padY + ph * 0.05, "런치 콤보", Math.round(ph * 0.045), "#0f172a", tw, ph * 0.11),
        newText(
          tx,
          padY + ph * 0.18,
          "₩ 9,900",
          Math.round(ph * 0.07),
          "#dc2626",
          tw,
          ph * 0.13,
        ),
        newText(
          tx,
          padY + ph * 0.34,
          "• 메인 + 음료 + 사이드\n• 11:30 – 14:00 한정\n• 포장 가능(문의)",
          Math.round(ph * 0.026),
          "#334155",
          tw,
          ph * 0.52,
        ),
      ];
    }
    case "menuPriceBoard": {
      const w = pw * 0.7;
      const x0 = mx - w / 2;
      return [
        newText(x0, ph * 0.05, "스페셜 메뉴", Math.round(ph * 0.05), "#0f172a", w, ph * 0.1),
        newText(
          x0,
          ph * 0.18,
          "트러플 리조토 ········· ₩ 18,000\n왕갈비 스테이크 ··· ₩ 24,000\n시그니처 파스타 ··· ₩ 15,000\n수제 티라미수 ····· ₩ 8,500\n오늘의 수프 ········· ₩ 6,000",
          Math.round(ph * 0.028),
          "#1e293b",
          w,
          ph * 0.58,
        ),
        newText(
          x0,
          ph * 0.8,
          "부가세 별도  ·  원산지 표기는 직원에게 문의",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.12,
        ),
      ];
    }
    case "menuQuadGrid": {
      const titleW = pw * 0.9;
      const gap = pw * 0.02;
      const cellW = (pw - padX * 2 - gap) / 2;
      const cellH = ph * 0.3;
      const topY = ph * 0.12;
      const leftX = padX;
      const rightX = padX + cellW + gap;
      const row2Y = topY + cellH + gap;
      const footW = pw - padX * 2;
      return [
        newText(mx - titleW / 2, ph * 0.035, "오늘의 추천", Math.round(ph * 0.046), "#0f172a", titleW, ph * 0.08),
        newImage(leftX, topY, cellW, cellH, stockPath(0), { borderRadius: 10, objectFit: "cover" }),
        newImage(rightX, topY, cellW, cellH, stockPath(1), { borderRadius: 10, objectFit: "cover" }),
        newImage(leftX, row2Y, cellW, cellH, stockPath(2), { borderRadius: 10, objectFit: "cover" }),
        newImage(rightX, row2Y, cellW, cellH, stockPath(3), { borderRadius: 10, objectFit: "cover" }),
        newText(
          padX,
          row2Y + cellH + ph * 0.04,
          "사진은 연출 예시입니다. 알레르기 성분은 주문 시 확인해 주세요.",
          Math.round(ph * 0.022),
          "#64748b",
          footW,
          ph * 0.14,
        ),
      ];
    }
    case "menuStackedPhotos": {
      const imgW = pw * 0.3;
      const gapY = ph * 0.02;
      const imgH = (ph * 0.62 - gapY * 2) / 3;
      const leftX = padX;
      const top0 = ph * 0.08;
      const textX = leftX + imgW + pw * 0.04;
      const textW = pw - textX - padX;
      return [
        newText(textX, ph * 0.05, "시즌 메뉴", Math.round(ph * 0.044), "#0f172a", textW, ph * 0.09),
        newImage(leftX, top0, imgW, imgH, stockPath(4), { borderRadius: 8, objectFit: "cover" }),
        newImage(leftX, top0 + imgH + gapY, imgW, imgH, stockPath(5), { borderRadius: 8, objectFit: "cover" }),
        newImage(leftX, top0 + (imgH + gapY) * 2, imgW, imgH, stockPath(6), { borderRadius: 8, objectFit: "cover" }),
        newText(
          textX,
          ph * 0.16,
          "봄 한정\n벚꽃 라떼 ····· ₩ 5,500\n딸기 크로와상 · ₩ 4,800\n\n단체·예약 문의 환영",
          Math.round(ph * 0.026),
          "#334155",
          textW,
          ph * 0.72,
        ),
      ];
    }
    case "noticeBoard": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "중요 공지", Math.round(ph * 0.048), "#b91c1c", w, ph * 0.1),
        newText(
          padX,
          padY + ph * 0.13,
          "안내 내용을 이곳에 작성하세요.\n\n• 임시 휴무 및 단축 영업\n• 결제·환불 관련 안내\n• 고객 협조 사항",
          Math.round(ph * 0.028),
          "#1e293b",
          w,
          ph * 0.52,
        ),
        newText(
          padX,
          ph - padY - ph * 0.14,
          "운영 시간  09:00 – 22:00   ·   문의  02-0000-0000",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.11,
        ),
      ];
    }
    case "noticeWeeklyHours": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "운영 시간 안내", Math.round(ph * 0.046), "#0f172a", w, ph * 0.1),
        newText(
          padX,
          padY + ph * 0.12,
          "월–금  07:00 – 22:00\n토요일  09:00 – 21:00\n일·공휴일  10:00 – 20:00\n\n※ 명절·시설 점검 시 별도 공지\n※ 라스트 오더 종료 30분 전",
          Math.round(ph * 0.028),
          "#334155",
          w,
          ph * 0.58,
        ),
        newText(
          padX,
          ph - padY - ph * 0.12,
          "고객센터  1588-0000  ·  홈페이지에서 실시간 혼잡도 확인",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.1,
        ),
      ];
    }
    case "noticeEmergency": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "긴급 안내", Math.round(ph * 0.05), "#b91c1c", w, ph * 0.1),
        newText(
          padX,
          padY + ph * 0.12,
          "일시적으로 엘리베이터 2호기 이용이 중단됩니다.\n\n• 예상 복구: 당일 18:00\n• 비상 시 안내 데스크로 연락\n• 휠체어 동선은 1층 북쪽 출입구를 이용해 주세요",
          Math.round(ph * 0.028),
          "#1e293b",
          w,
          ph * 0.48,
        ),
        newText(
          padX,
          padY + ph * 0.64,
          "안전에 협조해 주셔서 감사합니다.",
          Math.round(ph * 0.024),
          "#475569",
          w,
          ph * 0.1,
        ),
        newText(
          padX,
          ph - padY - ph * 0.12,
          "시설 관리팀  02-0000-0000 (내선 9)",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.1,
        ),
      ];
    }
    case "noticeParkingInfo": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "방문·주차 안내", Math.round(ph * 0.044), "#0f172a", w, ph * 0.1),
        newText(
          padX,
          padY + ph * 0.12,
          "• 방문 차량은 지하 2층 B구역을 이용해 주세요.\n• 2시간 무료, 이후 10분당 과금(영수증 소지 시 할인).\n• 대형 승합차는 지상 주차장 안내 데스크에 문의.\n• 전기차 충전기는 B-12~15 구역에 있습니다.",
          Math.round(ph * 0.026),
          "#334155",
          w,
          ph * 0.52,
        ),
        newText(
          padX,
          ph - padY - ph * 0.14,
          "주차 문의  02-0000-0000  ·  분실물은 로비 데스크",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.12,
        ),
      ];
    }
    case "lifeWifiGuest": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "게스트 Wi-Fi", Math.round(ph * 0.048), "#0f172a", w, ph * 0.11),
        newText(
          padX,
          padY + ph * 0.13,
          "네트워크 이름 (SSID)\nOurCafe_Guest\n\n비밀번호\nwelcome2026\n\n• 개인 업무·금융 거래는 가급적 자제\n• 대용량 다운로드 제한이 있을 수 있습니다",
          Math.round(ph * 0.028),
          "#334155",
          w,
          ph * 0.58,
        ),
        newText(
          padX,
          ph - padY - ph * 0.14,
          "문제가 있으면 카운터로 알려 주세요  ·  QR 접속 안내는 하단에 배치 가능",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.12,
        ),
      ];
    }
    case "lifeRestroom": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "화장실 안내", Math.round(ph * 0.046), "#0f172a", w, ph * 0.1),
        newText(
          padX,
          padY + ph * 0.12,
          "• 남·녀 화장실: 복도 끝 좌·우\n• 장애인 화장실: 엘리베이터 옆 (자동문)\n• 수유실·기저귀 교환대: 2층 패밀리 라운지\n• 유아 동반 시 에스컬레이터 대신 엘리베이터 이용을 권장합니다",
          Math.round(ph * 0.026),
          "#334155",
          w,
          ph * 0.62,
        ),
        newText(
          padX,
          ph - padY - ph * 0.12,
          "긴급 시 안내 데스크 내선 9",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.1,
        ),
      ];
    }
    case "lifeFloorDirectory": {
      const gap = padX * 0.6;
      const colW = (pw - padX * 2 - gap * 2) / 3;
      const x0 = padX;
      const x1 = padX + colW + gap;
      const x2 = padX + (colW + gap) * 2;
      const y0 = ph * 0.12;
      return [
        newText(mx - (pw * 0.44) / 2, padY, "층별 안내", Math.round(ph * 0.044), "#0f172a", pw * 0.44, ph * 0.09),
        newText(
          x0,
          y0,
          "B1\n푸드코트\n마트\n주차 정산",
          Math.round(ph * 0.024),
          "#334155",
          colW,
          ph * 0.72,
        ),
        newText(
          x1,
          y0,
          "1F\n로비·카페\n리셉션\n안내 데스크",
          Math.round(ph * 0.024),
          "#334155",
          colW,
          ph * 0.72,
        ),
        newText(
          x2,
          y0,
          "2F–4F\n사무실\n회의실\n코워킹",
          Math.round(ph * 0.024),
          "#334155",
          colW,
          ph * 0.72,
        ),
      ];
    }
    case "lifeSafetyHygiene": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "안전·위생 수칙", Math.round(ph * 0.048), "#b91c1c", w, ph * 0.1),
        newText(
          padX,
          padY + ph * 0.12,
          "• 작업 전 손 씻기 · 위생모·장갑 착용\n• 바닥 물기·기름때 즉시 표시 및 제거\n• 응급 상황 시 비상벨과 대피로 안내를 따르세요\n• 식품 알레르기 표기 라벨을 확인한 뒤 출고\n• CCTV 녹화 구역입니다",
          Math.round(ph * 0.026),
          "#1e293b",
          w,
          ph * 0.62,
        ),
        newText(
          padX,
          ph - padY - ph * 0.12,
          "문의: 시설 안전 담당  내선 1200",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.1,
        ),
      ];
    }
    case "lifeLostFound": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "분실물 센터", Math.round(ph * 0.046), "#0f172a", w, ph * 0.1),
        newText(
          padX,
          padY + ph * 0.12,
          "• 위치: 1층 로비 북쪽 안내 데스크 옆\n• 운영: 매일 10:00 – 19:00\n• 습득물은 3개월 보관 후 처리될 수 있습니다\n• 지갑·전자기기 등 귀중품은 경비실로 이관될 수 있습니다",
          Math.round(ph * 0.026),
          "#334155",
          w,
          ph * 0.54,
        ),
        newText(
          padX,
          ph - padY - ph * 0.16,
          "문의  02-0000-0000  ·  습득 시에도 이 번호로 연락 주세요",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.14,
        ),
      ];
    }
    case "lifeTodaySchedule": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "오늘의 일정", Math.round(ph * 0.044), "#0f172a", w, ph * 0.09),
        newText(
          padX,
          padY + ph * 0.11,
          "09:00  오프닝 · 등록\n10:30  기조연설  (홀 A)\n12:00  점심 네트워킹  (로비)\n14:00  세션 1 · UX 워크숍\n15:30  휴식\n16:00  세션 2 · 패널 토론\n18:00  클로징 · 경품 추첨",
          Math.round(ph * 0.026),
          "#334155",
          w,
          ph * 0.68,
        ),
        newText(
          padX,
          ph - padY - ph * 0.08,
          "※ 시간은 현장 사정에 따라 변동될 수 있습니다",
          Math.round(ph * 0.02),
          "#94a3b8",
          w,
          ph * 0.07,
        ),
      ];
    }
    case "lifeWelcomeDesk": {
      const imgW = pw * 0.32;
      const imgH = ph * 0.55;
      const textX = padX + imgW + pw * 0.04;
      const textW = pw - textX - padX;
      return [
        newImage(padX, padY + ph * 0.04, imgW, imgH, stockPath(0), { borderRadius: 12, objectFit: "cover" }),
        newText(textX, padY + ph * 0.04, "방문을 환영합니다", Math.round(ph * 0.042), "#0f172a", textW, ph * 0.12),
        newText(
          textX,
          padY + ph * 0.16,
          "• 방문 등록: 태블릿 또는 QR로 체크인\n• 방문증 수령 후 보안 게이트를 통과해 주세요\n• 동행인은 반드시 함께 등록\n• 촬영·녹음은 사전 허가 구역만 가능합니다",
          Math.round(ph * 0.026),
          "#334155",
          textW,
          ph * 0.58,
        ),
        newText(
          padX,
          ph - padY - ph * 0.12,
          "리셉션  02-0000-0000  ·  1층 로비",
          Math.round(ph * 0.022),
          "#64748b",
          pw - padX * 2,
          ph * 0.1,
        ),
      ];
    }
    case "lifeMeetingRoom": {
      const w = pw * 0.84;
      const x0 = mx - w / 2;
      return [
        newText(x0, ph * 0.08, "회의실 3-A", Math.round(ph * 0.056), "#0f172a", w, ph * 0.13),
        newText(
          x0,
          ph * 0.24,
          "2026 분기 전략 리뷰",
          Math.round(ph * 0.036),
          "#1d4ed8",
          w,
          ph * 0.1,
        ),
        newText(
          x0,
          ph * 0.36,
          "14:00 – 15:30\n참석: 기획·개발·디자인 리드\n\n※ 정시 시작  ·  외부인 출입 시 호스트 동반",
          Math.round(ph * 0.026),
          "#334155",
          w,
          ph * 0.48,
        ),
      ];
    }
    case "lifeStorefront": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "SPRING SALE  ~4/15", Math.round(ph * 0.038), "#b91c1c", w, ph * 0.09),
        newText(padX, padY + ph * 0.11, "OPEN", Math.round(ph * 0.072), "#0f172a", w, ph * 0.14),
        newText(
          padX,
          padY + ph * 0.27,
          "월–금  10:30 – 21:00\n토·일·공휴일  11:00 – 22:00\n\n전 품목 10% (일부 제외)\n멤버십 중복 할인 가능",
          Math.round(ph * 0.028),
          "#334155",
          w,
          ph * 0.52,
        ),
        newText(
          padX,
          ph - padY - ph * 0.12,
          "○○역 3번 출구 도보 2분  ·  주차 2시간 무료",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.1,
        ),
      ];
    }
    case "lifeEventGate": {
      const w = pw - padX * 2;
      return [
        newText(padX, padY, "2026 도시놀이 페스티벌", Math.round(ph * 0.044), "#0f172a", w, ph * 0.12),
        newText(
          padX,
          padY + ph * 0.14,
          "입장 게이트 B\n\n• 티켓(모바일/종이)과 신분증을 준비해 주세요\n• 가방 검사 및 금지품 안내에 협조 부탁드립니다\n• 재입장은 당일 팔찌 소지자에 한합니다\n• 우천 시 일부 야외 무대 일정이 조정될 수 있습니다",
          Math.round(ph * 0.026),
          "#334155",
          w,
          ph * 0.58,
        ),
        newText(
          padX,
          ph - padY - ph * 0.12,
          "주최 스태프는 보라색 조끼  ·  긴급 119·안내소",
          Math.round(ph * 0.022),
          "#64748b",
          w,
          ph * 0.1,
        ),
      ];
    }
    case "newsFlash": {
      const imgW = pw * 0.9;
      const imgH = ph * 0.34;
      const imgX = mx - imgW / 2;
      const bodyW = pw * 0.88;
      return [
        newImage(imgX, padY, imgW, imgH, stockPath(8), { borderRadius: 8, objectFit: "cover" }),
        newText(
          mx - bodyW / 2,
          padY + imgH + ph * 0.025,
          "속보 · 2025.03.28  14:00",
          Math.round(ph * 0.022),
          "#64748b",
          bodyW,
          ph * 0.06,
        ),
        newText(
          mx - bodyW / 2,
          padY + imgH + ph * 0.09,
          "헤드라인: 한 줄로 요약되는 핵심 소식",
          Math.round(ph * 0.04),
          "#0f172a",
          bodyW,
          ph * 0.11,
        ),
        newText(
          mx - bodyW / 2,
          padY + imgH + ph * 0.22,
          "리드 문단입니다. 로비·엘리베이터 옆 패널에서 짧게 전달할 내용을 2~4문장으로 적습니다.",
          Math.round(ph * 0.026),
          "#334155",
          bodyW,
          ph * 0.32,
        ),
      ];
    }
    case "newsFeature": {
      const imgW = pw * 0.9;
      const imgH = ph * 0.36;
      const imgX = mx - imgW / 2;
      const bodyW = pw * 0.86;
      return [
        newImage(imgX, padY, imgW, imgH, stockPath(2), { borderRadius: 8, objectFit: "cover" }),
        newText(
          mx - bodyW / 2,
          padY + imgH + ph * 0.03,
          "뉴스 피처 제목",
          Math.round(ph * 0.042),
          "#0f172a",
          bodyW,
          ph * 0.1,
        ),
        newText(
          mx - bodyW / 2,
          padY + imgH + ph * 0.13,
          "리드: 독자가 알아야 할 배경과 핵심을 2~3문장으로 설명합니다.",
          Math.round(ph * 0.026),
          "#334155",
          bodyW,
          ph * 0.14,
        ),
        newText(
          mx - bodyW / 2,
          padY + imgH + ph * 0.3,
          "• 관련 포인트 하나\n• 관련 포인트 둘\n• 관련 포인트 셋",
          Math.round(ph * 0.024),
          "#475569",
          bodyW,
          ph * 0.32,
        ),
      ];
    }
    case "newsDual": {
      const colW = (pw - padX * 3) / 2;
      const gap = padX;
      const lx = padX;
      const rx = padX + colW + gap;
      const y0 = ph * 0.08;
      return [
        newText(lx, y0, "단신 A", Math.round(ph * 0.034), "#0f172a", colW, ph * 0.09),
        newText(
          lx,
          y0 + ph * 0.11,
          "첫 번째 소식 요약입니다. 두세 문장으로 핵심만 전달합니다.",
          Math.round(ph * 0.024),
          "#334155",
          colW,
          ph * 0.68,
        ),
        newText(rx, y0, "단신 B", Math.round(ph * 0.034), "#0f172a", colW, ph * 0.09),
        newText(
          rx,
          y0 + ph * 0.11,
          "두 번째 소식 요약입니다. 날짜·장소를 넣어도 좋습니다.",
          Math.round(ph * 0.024),
          "#334155",
          colW,
          ph * 0.68,
        ),
      ];
    }
    case "newsTriptych": {
      const gap = pw * 0.025;
      const colW = (pw - padX * 2 - gap * 2) / 3;
      const imgH = ph * 0.28;
      const yImg = ph * 0.06;
      const x0 = padX;
      const x1 = padX + colW + gap;
      const x2 = padX + (colW + gap) * 2;
      const yText = yImg + imgH + ph * 0.03;
      const textH = ph * 0.22;
      const capY = yText + ph * 0.09 + textH + ph * 0.02;
      const capW = pw - padX * 2;
      return [
        newImage(x0, yImg, colW, imgH, stockPath(6), { borderRadius: 6, objectFit: "cover" }),
        newImage(x1, yImg, colW, imgH, stockPath(7), { borderRadius: 6, objectFit: "cover" }),
        newImage(x2, yImg, colW, imgH, stockPath(8), { borderRadius: 6, objectFit: "cover" }),
        newText(x0, yText, "지역 행사", Math.round(ph * 0.028), "#0f172a", colW, ph * 0.08),
        newText(
          x0,
          yText + ph * 0.09,
          "주말 플리마켓과 공연 일정을 한눈에.",
          Math.round(ph * 0.022),
          "#475569",
          colW,
          textH,
        ),
        newText(x1, yText, "교통 안내", Math.round(ph * 0.028), "#0f172a", colW, ph * 0.08),
        newText(
          x1,
          yText + ph * 0.09,
          "임시 우회 도로 및 셔틀 버스 노선.",
          Math.round(ph * 0.022),
          "#475569",
          colW,
          textH,
        ),
        newText(x2, yText, "날씨·미세먼지", Math.round(ph * 0.028), "#0f172a", colW, ph * 0.08),
        newText(
          x2,
          yText + ph * 0.09,
          "오늘의 기온과 야외 활동 지수.",
          Math.round(ph * 0.022),
          "#475569",
          colW,
          textH,
        ),
        newText(
          padX,
          capY,
          "출처 · 방송국 로비 정보 패널  ·  업데이트 14:00",
          Math.round(ph * 0.02),
          "#94a3b8",
          capW,
          ph * 0.12,
        ),
      ];
    }
    case "newsBulletin": {
      const w = pw * 0.88;
      const x0 = mx - w / 2;
      return [
        newText(x0, ph * 0.06, "오늘의 주요 소식", Math.round(ph * 0.042), "#0f172a", w, ph * 0.11),
        newText(
          x0,
          ph * 0.2,
          "① 시청 앞 광장 리뉴얼 착공\n② 지하철 3호선 야간 연장(금·토)\n③ 시립도서관 야간 개관 시범\n④ 시민 건강검진 예약 오픈\n\n※ 자세한 내용은 시 홈페이지 참고",
          Math.round(ph * 0.026),
          "#334155",
          w,
          ph * 0.68,
        ),
      ];
    }
    case "newsPhotoSide": {
      const imgW = pw * 0.36;
      const imgH = ph - padY * 2;
      const textX = padX + imgW + pw * 0.04;
      const textW = pw - textX - padX;
      return [
        newImage(padX, padY, imgW, imgH, stockPath(9), { borderRadius: 10, objectFit: "cover" }),
        newText(textX, padY + ph * 0.04, "현장 인터뷰", Math.round(ph * 0.04), "#0f172a", textW, ph * 0.12),
        newText(
          textX,
          padY + ph * 0.17,
          "현장에서 전하는 생생한 목소리입니다. 준비 과정과 기대 포인트를 3~4문단으로 정리해 로비 패널에 게시하세요.",
          Math.round(ph * 0.026),
          "#334155",
          textW,
          ph * 0.48,
        ),
        newText(
          textX,
          ph - padY - ph * 0.16,
          "기자 김○○  ·  사진 제공 시민기자단",
          Math.round(ph * 0.022),
          "#64748b",
          textW,
          ph * 0.12,
        ),
      ];
    }
    case "photoHero": {
      const imgH = ph * 0.52;
      const titleW = pw * 0.88;
      const subW = pw * 0.75;
      return [
        newImage(0, 0, pw, imgH, stockPath(0), { borderRadius: 0, objectFit: "cover" }),
        newText(
          mx - titleW / 2,
          imgH + ph * 0.04,
          "캠페인 한 줄 메시지",
          Math.round(ph * 0.055),
          "#0f172a",
          titleW,
          ph * 0.12,
        ),
        newText(
          mx - subW / 2,
          imgH + ph * 0.16,
          "부제 · 기간 · 장소",
          Math.round(ph * 0.026),
          "#64748b",
          subW,
          ph * 0.09,
        ),
      ];
    }
    case "editorialSplit": {
      const colW = pw * 0.4;
      const colH = ph - padY * 2;
      const textW = pw - padX * 3 - colW;
      const textX = padX * 2 + colW;
      return [
        newImage(padX, padY, colW, colH, stockPath(1), { borderRadius: 10, objectFit: "cover" }),
        newText(
          textX,
          padY + ph * 0.02,
          "브랜드 스토리",
          Math.round(ph * 0.038),
          "#0f172a",
          textW,
          ph * 0.1,
        ),
        newText(
          textX,
          padY + ph * 0.14,
          "긴 본문을 배치합니다. 연혁·철학·캠페인 설명 등 사이니지에서 스크롤 없이 한 화면에 담을 때 사용하세요.",
          Math.round(ph * 0.024),
          "#334155",
          textW,
          ph * 0.62,
        ),
        newText(
          textX,
          ph - padY - ph * 0.12,
          "하단 각주 · 웹/QR 안내",
          Math.round(ph * 0.02),
          "#94a3b8",
          textW,
          ph * 0.1,
        ),
      ];
    }
    case "coverPhoto": {
      const inset = pw * 0.04;
      const imgW = pw - inset * 2;
      const imgH = ph * 0.72;
      const tw = pw - inset * 2;
      return [
        newImage(inset, inset, imgW, imgH, stockPath(6), { borderRadius: 14, objectFit: "cover" }),
        newText(
          inset,
          inset + imgH + ph * 0.028,
          "시즌 · 전시 · 브랜드명",
          Math.round(ph * 0.05),
          "#0f172a",
          tw,
          ph * 0.1,
        ),
        newText(
          inset,
          inset + imgH + ph * 0.12,
          "부제 또는 기간",
          Math.round(ph * 0.026),
          "#64748b",
          tw,
          ph * 0.08,
        ),
      ];
    }
    case "visualFilmRow": {
      const gap = pw * 0.015;
      const thumbW = (pw - padX * 2 - gap * 3) / 4;
      const thumbH = ph * 0.48;
      const topY = ph * 0.1;
      const x0 = padX;
      const titleW = pw * 0.88;
      return [
        newImage(x0, topY, thumbW, thumbH, stockPath(0), { borderRadius: 6, objectFit: "cover" }),
        newImage(x0 + thumbW + gap, topY, thumbW, thumbH, stockPath(1), { borderRadius: 6, objectFit: "cover" }),
        newImage(x0 + (thumbW + gap) * 2, topY, thumbW, thumbH, stockPath(2), {
          borderRadius: 6,
          objectFit: "cover",
        }),
        newImage(x0 + (thumbW + gap) * 3, topY, thumbW, thumbH, stockPath(3), {
          borderRadius: 6,
          objectFit: "cover",
        }),
        newText(
          mx - titleW / 2,
          topY + thumbH + ph * 0.04,
          "컬렉션 2026  ·  시즌 룩",
          Math.round(ph * 0.048),
          "#0f172a",
          titleW,
          ph * 0.11,
        ),
        newText(
          mx - titleW / 2,
          topY + thumbH + ph * 0.16,
          "매장 및 온라인 몰에서 동일 라인업을 만나보세요.",
          Math.round(ph * 0.024),
          "#64748b",
          titleW,
          ph * 0.14,
        ),
      ];
    }
    case "visualMosaicL": {
      const gap = pw * 0.02;
      const bigW = pw * 0.52;
      const bigH = ph * 0.58;
      const smallW = pw - padX * 2 - bigW - gap;
      const smallH = (bigH - gap) / 2;
      const leftX = padX;
      const rightX = leftX + bigW + gap;
      const topY = ph * 0.06;
      const tw = pw - padX * 2;
      return [
        newImage(leftX, topY, bigW, bigH, stockPath(4), { borderRadius: 12, objectFit: "cover" }),
        newImage(rightX, topY, smallW, smallH, stockPath(5), { borderRadius: 8, objectFit: "cover" }),
        newImage(rightX, topY + smallH + gap, smallW, smallH, stockPath(6), {
          borderRadius: 8,
          objectFit: "cover",
        }),
        newText(
          padX,
          topY + bigH + ph * 0.04,
          "여정의 한 장면",
          Math.round(ph * 0.045),
          "#0f172a",
          tw,
          ph * 0.1,
        ),
        newText(
          padX,
          topY + bigH + ph * 0.14,
          "브랜드 캠페인·여행기·전시 연계에 어울리는 비대칭 레이아웃입니다.",
          Math.round(ph * 0.024),
          "#475569",
          tw,
          ph * 0.16,
        ),
      ];
    }
    case "visualTypoCenter": {
      const w = pw * 0.84;
      const x0 = mx - w / 2;
      return [
        newText(x0, ph * 0.28, "BE PRESENT", Math.round(ph * 0.09), "#0f172a", w, ph * 0.18),
        newText(
          x0,
          ph * 0.48,
          "지금 이 순간  ·  2026 캠페인",
          Math.round(ph * 0.026),
          "#64748b",
          w,
          ph * 0.08,
        ),
        newText(
          x0,
          ph * 0.58,
          "짧은 문장으로 브랜드 약속이나 행사 슬로건을 전달하세요.\n하단에 일정·장소·QR 안내를 덧붙일 수 있습니다.",
          Math.round(ph * 0.024),
          "#475569",
          w,
          ph * 0.32,
        ),
      ];
    }
    case "visualMagazineTop": {
      const imgH = ph * 0.38;
      const bodyW = (pw - padX * 3) / 2;
      const gap = padX;
      const lx = padX;
      const rx = padX + bodyW + gap;
      const y0 = imgH + ph * 0.04;
      const titleW = pw * 0.9;
      return [
        newImage(0, 0, pw, imgH, stockPath(7), { borderRadius: 0, objectFit: "cover" }),
        newText(mx - titleW / 2, y0, "화보: 도시의 빛", Math.round(ph * 0.048), "#0f172a", titleW, ph * 0.1),
        newText(
          lx,
          y0 + ph * 0.12,
          "야경 프로젝트의 시작은 작은 조명 하나에서였습니다. 거리 곳곳에 숨은 이야기를 짧은 에세이 형식으로 풀어냅니다.",
          Math.round(ph * 0.024),
          "#334155",
          bodyW,
          ph * 0.42,
        ),
        newText(
          rx,
          y0 + ph * 0.12,
          "사진가 노트와 촬영 스팟 지도는 QR로 연결할 수 있습니다. 전시 일정과 협찬 문구는 이 칸에 배치하세요.",
          Math.round(ph * 0.024),
          "#334155",
          bodyW,
          ph * 0.42,
        ),
        newText(
          padX,
          ph - padY - ph * 0.08,
          "Vol. 12  ·  편집실  ·  사진 제공 스튜디오 M",
          Math.round(ph * 0.02),
          "#94a3b8",
          pw - padX * 2,
          ph * 0.06,
        ),
      ];
    }
    default:
      return [];
  }
}
