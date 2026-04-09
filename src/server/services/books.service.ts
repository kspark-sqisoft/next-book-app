import { asc, count, desc, eq, inArray, like, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { book as bookTable, bookPage } from "@/server/db/schema";
import {
  AVATARS_SUBDIR,
  BOOK_IMAGES_SUBDIR,
  BOOK_VIDEO_POSTERS_SUBDIR,
  BOOK_VIDEOS_SUBDIR,
} from "@/server/env";
import { type AuthActor, canMutateOwnedResource } from "@/server/auth/auth-policy";
import { HttpError } from "@/server/http/http-error";
import type { BookPageInputDto, CreateBookDto, UpdateBookDto } from "./books-types";

const TITLE_MAX = 200;
const MAX_PAGES = 80;
const MAX_ELEMENTS_PER_PAGE = 120;
const DEFAULT_PAGE_W = 960;
const DEFAULT_PAGE_H = 540;
const PAGE_NAME_MAX = 120;

/** 슬라이드쇼 전환 — 프론트 `book-presentation-transition.ts`와 동일 키 유지 */
const BOOK_PAGE_PRESENTATION_TRANSITIONS = new Set([
  'none',
  'fade',
  'slideLeft',
  'slideRight',
  'slideUp',
  'slideDown',
  'zoomIn',
  'blurIn',
]);
const DEFAULT_PRESENTATION_TRANSITION = 'none';
const DEFAULT_PRESENTATION_TRANSITION_MS = 450;

function normalizeBookPagePresentationTransition(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (BOOK_PAGE_PRESENTATION_TRANSITIONS.has(s)) return s;
  return DEFAULT_PRESENTATION_TRANSITION;
}

function normalizeBookPagePresentationTransitionMs(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PRESENTATION_TRANSITION_MS;
  return Math.min(2500, Math.max(80, Math.round(n)));
}

export type BookAuthorPublic = {
  id: number;
  name: string;
  imageUrl: string | null;
};

export type BookCanvasElementPublic =
  | {
      id: string;
      type: 'text';
      x: number;
      y: number;
      text: string;
      richHtml?: string;
      fontSize: number;
      fill: string;
      width?: number;
      height?: number;
      /** 위젯 박스 안 텍스트 블록 세로 위치(top|middle|bottom) */
      verticalAlign?: 'top' | 'middle' | 'bottom';
      /** 0~1, 생략 시 1 */
      opacity?: number;
      /** 시계 방향 도(°), 생략 시 0 */
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      /** false면 보기·썸네일에서 숨김 */
      visible?: boolean;
      /** true면 캔버스에서 이동·크기·삭제(컨텍스트) 불가 */
      locked?: boolean;
    }
  | {
      id: string;
      type: 'image';
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
      objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
    }
  | {
      id: string;
      type: 'video';
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
      posterSrc: string | null;
      objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
    }
  | {
      id: string;
      type: 'weather';
      x: number;
      y: number;
      width: number;
      height: number;
      cityQuery?: string;
      weatherDisplay?: Record<string, boolean>;
      weatherBackground?: string;
      weatherTextColor?: string;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
    }
  | {
      id: string;
      type: 'digitalClock';
      x: number;
      y: number;
      width: number;
      height: number;
      clockDisplay?: Record<string, boolean>;
      /** CSS 배경색(rgba 등). */
      clockBackground?: string;
      clockTextColor?: string;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
    }
  | {
      id: string;
      type: 'news';
      x: number;
      y: number;
      width: number;
      height: number;
      newsCountry?: string;
      newsCategory?: string;
      newsPageSize?: number;
      newsDisplayMode?: 'list' | 'carousel';
      newsCarouselIntervalSec?: number;
      newsBackground?: string;
      newsTextColor?: string;
      newsMetaColor?: string;
      newsTitleFontSize?: number;
      newsMetaFontSize?: number;
      newsSectionTitle?: string;
      newsTitleLineClamp?: number;
      newsContentPaddingPx?: number;
      newsShowHeader?: boolean;
      newsShowSource?: boolean;
      newsLinksEnabled?: boolean;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
    }
  | {
      id: string;
      type: 'mediaPlaylist';
      x: number;
      y: number;
      width: number;
      height: number;
      mediaPlaylistItems?: Array<
        | {
            id: string;
            kind: 'image';
            src: string;
            durationSec?: number;
            objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
          }
        | {
            id: string;
            kind: 'video';
            src: string;
            posterSrc: string | null;
            objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
          }
      >;
      mediaPlaylistLoop?: boolean;
      mediaPlaylistShowControls?: boolean;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
    }
  | {
      id: string;
      type: 'drawing';
      x: number;
      y: number;
      width: number;
      height: number;
      points: number[];
      stroke: string;
      strokeWidth: number;
      opacity?: number;
      rotation?: number;
      visible?: boolean;
      locked?: boolean;
    }
  | {
      id: string;
      type: 'shape';
      x: number;
      y: number;
      width: number;
      height: number;
      shapeKind:
        | 'rect'
        | 'roundRect'
        | 'ellipse'
        | 'line'
        | 'triangle'
        | 'rightTriangle'
        | 'arrow'
        | 'chevron'
        | 'star'
        | 'diamond'
        | 'hexagon'
        | 'pentagon'
        | 'octagon'
        | 'trapezoid'
        | 'parallelogram'
        | 'ring'
        | 'blockArc'
        | 'plus'
        | 'cross';
      fill: string;
      stroke: string;
      strokeWidth: number;
      cornerRadius?: number;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
      presentationHoldSec?: number;
    };

export type BookPagePublic = {
  id: number;
  sortOrder: number;
  /** 표시용 이름; 빈 문자열이면 UI에서 "슬라이드 n" */
  name: string;
  /** 슬라이드 배경(CSS 색) */
  backgroundColor: string;
  elements: BookCanvasElementPublic[];
  /** 미리보기 페이지 체류 시간 기준이 되는 요소 id */
  presentationTimingElementId: string | null;
  /** 이 슬라이드로 들어올 때 전환 효과 */
  presentationTransition: string;
  /** 전환 지속(ms) */
  presentationTransitionMs: number;
};

/** 목록 카드 배경용 첫 슬라이드 미리보기 */
export type BookListCoverPreviewPublic = {
  slideWidth: number;
  slideHeight: number;
  backgroundColor: string;
  elements: BookCanvasElementPublic[];
};

export type BookListItemPublic = {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  author: BookAuthorPublic;
  pageCount: number;
  /** 첫 페이지(정렬 기준) — 없으면 null */
  coverPreview: BookListCoverPreviewPublic | null;
};

export type BookPublic = {
  id: number;
  title: string;
  /** 모든 슬라이드 공통 캔버스 크기 */
  slideWidth: number;
  slideHeight: number;
  /** 미리보기 슬라이드쇼 반복 */
  presentationLoop: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: BookAuthorPublic;
  pages: BookPagePublic[];
};

type BookPageRow = typeof bookPage.$inferSelect;

export class BooksService {
  private db() {
    return getDb();
  }

  private authorAvatarUrl(profileImageFilename: string | null): string | null {
    if (!profileImageFilename) return null;
    return `/uploads/${AVATARS_SUBDIR}/${profileImageFilename}`;
  }

  private imagePublicUrl(filename: string): string {
    return `/uploads/${BOOK_IMAGES_SUBDIR}/${filename}`;
  }

  private videoPublicUrl(filename: string): string {
    return `/uploads/${BOOK_VIDEOS_SUBDIR}/${filename}`;
  }

  private posterPublicUrl(filename: string): string {
    return `/uploads/${BOOK_VIDEO_POSTERS_SUBDIR}/${filename}`;
  }

  private mapAuthor(u: {
    id: number;
    name: string;
    profileImageFilename: string | null;
  }): BookAuthorPublic {
    return {
      id: u.id,
      name: u.name,
      imageUrl: this.authorAvatarUrl(u.profileImageFilename),
    };
  }

  /**
   * 이미지·비디오 `src` 정규화: 업로드(`/uploads/...`) 또는 프론트 정적 샘플(`/cards/...`, 템플릿용).
   * 절대 URL·쿼리는 제거한 뒤 pathname만 반환.
   */
  private normalizeBookMediaUploadsPath(
    raw: unknown,
    maxLen = 500,
  ): string | null {
    if (typeof raw !== 'string') return null;
    const t = raw.trim();
    if (!t) return null;
    const noQuery = t.includes('?') ? t.slice(0, t.indexOf('?')) : t;
    const idx = noQuery.indexOf('/uploads/');
    if (idx >= 0) {
      const path = noQuery.slice(idx);
      return path.length > maxLen ? path.slice(0, maxLen) : path;
    }
    const cardsIdx = noQuery.indexOf('/cards/');
    if (cardsIdx >= 0) {
      const path = noQuery.slice(cardsIdx);
      if (!this.isSafeBookCardsStaticPath(path)) return null;
      return path.length > maxLen ? path.slice(0, maxLen) : path;
    }
    try {
      const p = new URL(noQuery).pathname;
      if (p.startsWith('/uploads/')) {
        return p.length > maxLen ? p.slice(0, maxLen) : p;
      }
      if (p.startsWith('/cards/') && this.isSafeBookCardsStaticPath(p)) {
        return p.length > maxLen ? p.slice(0, maxLen) : p;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * 이미지·동영상 요소의 src: 업로드·정적 카드 경로 또는 허용된 https CDN(Pexels·Vimeo 재생 링크).
   */
  private normalizeBookMediaElementSrc(
    raw: unknown,
    maxLen = 2000,
  ): string | null {
    const path = this.normalizeBookMediaUploadsPath(raw, 500);
    if (path != null) return path;

    if (typeof raw !== 'string') return null;
    const t = raw.trim();
    if (!t || t.length > maxLen) return null;

    try {
      const u = new URL(t);
      if (u.protocol !== 'https:') return null;
      const host = u.hostname.toLowerCase();
      if (
        host === 'player.vimeo.com' ||
        host.endsWith('.pexels.com') ||
        host.endsWith('.vimeocdn.com') ||
        host === 'vimeocdn.com'
      ) {
        return t;
      }
    } catch {
      return null;
    }
    return null;
  }

  /** 동영상 poster: 업로드·카드 또는 Pexels 계열 이미지 URL */
  private normalizeBookVideoPosterSrc(
    raw: unknown,
    maxLen = 2000,
  ): string | null {
    const path = this.normalizeBookMediaUploadsPath(raw, 500);
    if (path != null) return path;

    if (typeof raw !== 'string') return null;
    const t = raw.trim();
    if (!t || t.length > maxLen) return null;

    try {
      const u = new URL(t);
      if (u.protocol !== 'https:') return null;
      const host = u.hostname.toLowerCase();
      if (host.endsWith('.pexels.com')) {
        return t;
      }
    } catch {
      return null;
    }
    return null;
  }

  /** `/cards/img1.jpg` 등 — path traversal·이상한 확장자 차단 */
  private isSafeBookCardsStaticPath(path: string): boolean {
    if (!path.startsWith('/cards/')) return false;
    const rest = path.slice('/cards/'.length);
    if (!rest || rest.length > 240) return false;
    if (rest.includes('..') || rest.includes('//') || rest.includes('\\')) {
      return false;
    }
    if (rest.startsWith('/')) return false;
    return /^[\w][\w.-]*\.(jpe?g|png|gif|webp)$/i.test(rest);
  }

  private parseElementsJson(raw: string): BookCanvasElementPublic[] {
    try {
      const v = JSON.parse(raw) as unknown;
      if (!Array.isArray(v)) {
        throw new HttpError(400,'elements는 배열이어야 합니다.');
      }
      this.validateElements(v);
      return v as BookCanvasElementPublic[];
    } catch (e) {
      if (e instanceof HttpError && e.status === 400) throw e;
      throw new HttpError(400,'elements JSON이 올바르지 않습니다.');
    }
  }

  private validateElements(arr: unknown[]): void {
    if (arr.length > MAX_ELEMENTS_PER_PAGE) {
      throw new HttpError(400,
        `페이지당 요소는 최대 ${MAX_ELEMENTS_PER_PAGE}개입니다.`,
      );
    }
    for (const el of arr) {
      if (!el || typeof el !== 'object') {
        throw new HttpError(400,'요소 형식이 올바르지 않습니다.');
      }
      const o = el as Record<string, unknown>;
      if (typeof o.id !== 'string' || o.id.length > 80) {
        throw new HttpError(400,'요소 id가 올바르지 않습니다.');
      }
      if (
        o.type !== 'text' &&
        o.type !== 'image' &&
        o.type !== 'video' &&
        o.type !== 'weather' &&
        o.type !== 'digitalClock' &&
        o.type !== 'news' &&
        o.type !== 'mediaPlaylist' &&
        o.type !== 'drawing' &&
        o.type !== 'shape'
      ) {
        throw new HttpError(400,'지원하지 않는 요소 타입입니다.');
      }
      if (o.visible !== undefined && typeof o.visible !== 'boolean') {
        throw new HttpError(400,
          '요소 visible은 true 또는 false여야 합니다.',
        );
      }
      if (o.locked !== undefined && typeof o.locked !== 'boolean') {
        throw new HttpError(400,
          '요소 locked은 true 또는 false여야 합니다.',
        );
      }
      if (o.presentationHoldSec != null) {
        const ph = o.presentationHoldSec;
        if (
          typeof ph !== 'number' ||
          !Number.isInteger(ph) ||
          ph < 1 ||
          ph > 3600
        ) {
          throw new HttpError(400,
            '요소 presentationHoldSec는 1~3600 사이의 정수여야 합니다.',
          );
        }
      }
      const x = o.x;
      const y = o.y;
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        throw new HttpError(400,'요소 위치(x,y)가 올바르지 않습니다.');
      }
      if (o.type === 'text') {
        if (typeof o.text !== 'string' || o.text.length > 8000) {
          throw new HttpError(400,'텍스트 내용이 올바르지 않습니다.');
        }
        if (o.richHtml != null && typeof o.richHtml !== 'string') {
          throw new HttpError(400,
            '텍스트 richHtml 형식이 올바르지 않습니다.',
          );
        }
        if (typeof o.richHtml === 'string' && o.richHtml.length > 32000) {
          throw new HttpError(400,'리치 텍스트가 너무 깁니다.');
        }
        const fs = o.fontSize;
        if (typeof fs !== 'number' || fs < 8 || fs > 200) {
          throw new HttpError(400,'fontSize가 올바르지 않습니다.');
        }
        if (typeof o.fill !== 'string' || o.fill.length > 40) {
          throw new HttpError(400,'fill 색상이 올바르지 않습니다.');
        }
        if (o.width != null) {
          if (typeof o.width !== 'number' || o.width < 20 || o.width > 4000) {
            throw new HttpError(400,'텍스트 width가 올바르지 않습니다.');
          }
        }
        if (o.height != null) {
          if (
            typeof o.height !== 'number' ||
            o.height < 28 ||
            o.height > 4000
          ) {
            throw new HttpError(400,'텍스트 height가 올바르지 않습니다.');
          }
        }
        if (o.verticalAlign != null) {
          if (
            o.verticalAlign !== 'top' &&
            o.verticalAlign !== 'middle' &&
            o.verticalAlign !== 'bottom'
          ) {
            throw new HttpError(400,
              '텍스트 verticalAlign은 top, middle, bottom 중 하나여야 합니다.',
            );
          }
        }
      } else if (o.type === 'weather') {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 24 ||
          h < 24 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new HttpError(400,'날씨 위젯 크기가 올바르지 않습니다.');
        }
        if (o.cityQuery != null) {
          if (typeof o.cityQuery !== 'string' || o.cityQuery.length > 120) {
            throw new HttpError(400,
              '날씨 도시 검색어가 올바르지 않습니다.',
            );
          }
        }
        if (o.weatherDisplay != null) {
          if (
            typeof o.weatherDisplay !== 'object' ||
            Array.isArray(o.weatherDisplay)
          ) {
            throw new HttpError(400,
              'weatherDisplay 형식이 올바르지 않습니다.',
            );
          }
          const allowed = new Set([
            'temp',
            'feelsLike',
            'description',
            'icon',
            'humidity',
            'wind',
            'pm25',
            'pm10',
            'aqi',
            'clock',
            'date',
          ]);
          for (const [k, v] of Object.entries(
            o.weatherDisplay as Record<string, unknown>,
          )) {
            if (!allowed.has(k)) {
              throw new HttpError(400,
                'weatherDisplay에 허용되지 않는 키입니다.',
              );
            }
            if (typeof v !== 'boolean') {
              throw new HttpError(400,
                'weatherDisplay 값은 true/false만 가능합니다.',
              );
            }
          }
        }
        if (o.weatherBackground != null) {
          if (
            typeof o.weatherBackground !== 'string' ||
            o.weatherBackground.length > 80
          ) {
            throw new HttpError(400,
              '날씨 카드 배경색이 올바르지 않습니다.',
            );
          }
          if (
            /[<>]/.test(o.weatherBackground) ||
            /url\s*\(/i.test(o.weatherBackground)
          ) {
            throw new HttpError(400,
              '날씨 카드 배경색에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
      } else if (o.type === 'digitalClock') {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 24 ||
          h < 24 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new HttpError(400,
            '디지털 시계 위젯 크기가 올바르지 않습니다.',
          );
        }
        if (o.clockDisplay != null) {
          if (
            typeof o.clockDisplay !== 'object' ||
            Array.isArray(o.clockDisplay)
          ) {
            throw new HttpError(400,
              'clockDisplay 형식이 올바르지 않습니다.',
            );
          }
          const allowed = new Set(['seconds', 'date', 'hour12']);
          for (const [k, v] of Object.entries(
            o.clockDisplay as Record<string, unknown>,
          )) {
            if (!allowed.has(k)) {
              throw new HttpError(400,
                'clockDisplay에 허용되지 않는 키입니다.',
              );
            }
            if (typeof v !== 'boolean') {
              throw new HttpError(400,
                'clockDisplay 값은 true/false만 가능합니다.',
              );
            }
          }
        }
        if (o.clockBackground != null) {
          if (
            typeof o.clockBackground !== 'string' ||
            o.clockBackground.length > 80
          ) {
            throw new HttpError(400,
              '디지털 시계 배경색이 올바르지 않습니다.',
            );
          }
          if (
            /[<>]/.test(o.clockBackground) ||
            /url\s*\(/i.test(o.clockBackground)
          ) {
            throw new HttpError(400,
              '디지털 시계 배경색에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
        if (o.clockTextColor != null) {
          if (
            typeof o.clockTextColor !== 'string' ||
            o.clockTextColor.length > 80
          ) {
            throw new HttpError(400,
              '디지털 시계 글자색이 올바르지 않습니다.',
            );
          }
          if (
            /[<>]/.test(o.clockTextColor) ||
            /url\s*\(/i.test(o.clockTextColor)
          ) {
            throw new HttpError(400,
              '디지털 시계 글자색에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
      } else if (o.type === 'news') {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 24 ||
          h < 24 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new HttpError(400,'뉴스 위젯 크기가 올바르지 않습니다.');
        }
        if (o.newsCountry != null) {
          if (typeof o.newsCountry !== 'string') {
            throw new HttpError(400,
              '뉴스 국가 코드 형식이 올바르지 않습니다.',
            );
          }
          const c = o.newsCountry.trim().toLowerCase();
          if (c.length === 0) {
            delete (o as { newsCountry?: string }).newsCountry;
          } else if (c.length !== 2 || !/^[a-z]{2}$/.test(c)) {
            throw new HttpError(400,
              '뉴스 국가 코드는 ISO 영문 2자입니다. 비우면 기본 kr로 불러옵니다.',
            );
          } else {
            o.newsCountry = c;
          }
        }
        if (o.newsCategory != null) {
          const allowed = new Set([
            'business',
            'entertainment',
            'general',
            'health',
            'science',
            'sports',
            'technology',
          ]);
          if (
            typeof o.newsCategory !== 'string' ||
            !allowed.has(o.newsCategory.toLowerCase())
          ) {
            throw new HttpError(400,
              '뉴스 category 값이 올바르지 않습니다.',
            );
          }
        }
        if (o.newsPageSize != null) {
          const ps = o.newsPageSize;
          if (
            typeof ps !== 'number' ||
            ps < 1 ||
            ps > 10 ||
            !Number.isInteger(ps)
          ) {
            throw new HttpError(400,
              'newsPageSize는 1~10 정수여야 합니다.',
            );
          }
        }
        if (o.newsDisplayMode != null) {
          if (
            o.newsDisplayMode !== 'list' &&
            o.newsDisplayMode !== 'carousel'
          ) {
            throw new HttpError(400,
              'newsDisplayMode는 list 또는 carousel이어야 합니다.',
            );
          }
        }
        if (o.newsCarouselIntervalSec != null) {
          const iv = o.newsCarouselIntervalSec;
          if (
            typeof iv !== 'number' ||
            iv < 3 ||
            iv > 120 ||
            !Number.isInteger(iv)
          ) {
            throw new HttpError(400,
              'newsCarouselIntervalSec는 3~120 정수(초)여야 합니다.',
            );
          }
        }
        if (o.newsBackground != null) {
          if (
            typeof o.newsBackground !== 'string' ||
            o.newsBackground.length > 80
          ) {
            throw new HttpError(400,
              '뉴스 카드 배경색이 올바르지 않습니다.',
            );
          }
          if (
            /[<>]/.test(o.newsBackground) ||
            /url\s*\(/i.test(o.newsBackground)
          ) {
            throw new HttpError(400,
              '뉴스 카드 배경색에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
        if (o.newsTextColor != null) {
          if (
            typeof o.newsTextColor !== 'string' ||
            o.newsTextColor.length > 80
          ) {
            throw new HttpError(400,'뉴스 글자색이 올바르지 않습니다.');
          }
          if (
            /[<>]/.test(o.newsTextColor) ||
            /url\s*\(/i.test(o.newsTextColor)
          ) {
            throw new HttpError(400,
              '뉴스 글자색에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
        if (o.newsMetaColor != null) {
          if (
            typeof o.newsMetaColor !== 'string' ||
            o.newsMetaColor.length > 80
          ) {
            throw new HttpError(400,
              '뉴스 보조 글자색이 올바르지 않습니다.',
            );
          }
          if (
            /[<>]/.test(o.newsMetaColor) ||
            /url\s*\(/i.test(o.newsMetaColor)
          ) {
            throw new HttpError(400,
              '뉴스 보조 글자색에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
        if (o.newsTitleFontSize != null) {
          const fs = o.newsTitleFontSize;
          if (
            typeof fs !== 'number' ||
            !Number.isInteger(fs) ||
            fs < 10 ||
            fs > 32
          ) {
            throw new HttpError(400,
              'newsTitleFontSize는 10~32 정수(px)여야 합니다.',
            );
          }
        }
        if (o.newsMetaFontSize != null) {
          const fs = o.newsMetaFontSize;
          if (
            typeof fs !== 'number' ||
            !Number.isInteger(fs) ||
            fs < 8 ||
            fs > 22
          ) {
            throw new HttpError(400,
              'newsMetaFontSize는 8~22 정수(px)여야 합니다.',
            );
          }
        }
        if (o.newsSectionTitle != null) {
          if (
            typeof o.newsSectionTitle !== 'string' ||
            o.newsSectionTitle.length > 40
          ) {
            throw new HttpError(400,
              '뉴스 섹션 제목이 올바르지 않습니다.',
            );
          }
          if (/[<>]/.test(o.newsSectionTitle)) {
            throw new HttpError(400,
              '뉴스 섹션 제목에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
        if (o.newsTitleLineClamp != null) {
          const lc = o.newsTitleLineClamp;
          if (
            typeof lc !== 'number' ||
            !Number.isInteger(lc) ||
            lc < 1 ||
            lc > 6
          ) {
            throw new HttpError(400,
              'newsTitleLineClamp는 1~6 정수여야 합니다.',
            );
          }
        }
        if (o.newsContentPaddingPx != null) {
          const pad = o.newsContentPaddingPx;
          if (
            typeof pad !== 'number' ||
            !Number.isInteger(pad) ||
            pad < 4 ||
            pad > 40
          ) {
            throw new HttpError(400,
              'newsContentPaddingPx는 4~40 정수(캔버스 px)여야 합니다.',
            );
          }
        }
        if (o.newsShowHeader != null && typeof o.newsShowHeader !== 'boolean') {
          throw new HttpError(400,
            'newsShowHeader는 불리언이어야 합니다.',
          );
        }
        if (o.newsShowSource != null && typeof o.newsShowSource !== 'boolean') {
          throw new HttpError(400,
            'newsShowSource는 불리언이어야 합니다.',
          );
        }
        if (
          o.newsLinksEnabled != null &&
          typeof o.newsLinksEnabled !== 'boolean'
        ) {
          throw new HttpError(400,
            'newsLinksEnabled는 불리언이어야 합니다.',
          );
        }
      } else if (o.type === 'mediaPlaylist') {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 48 ||
          h < 48 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new HttpError(400,
            '미디어 플레이리스트 위젯 크기가 올바르지 않습니다.',
          );
        }
        const rawItems = o.mediaPlaylistItems;
        if (rawItems !== undefined && !Array.isArray(rawItems)) {
          throw new HttpError(400,
            'mediaPlaylistItems는 배열이어야 합니다.',
          );
        }
        const items = Array.isArray(rawItems) ? rawItems : [];
        if (items.length > 40) {
          throw new HttpError(400,
            '미디어 플레이리스트는 최대 40개까지 넣을 수 있습니다.',
          );
        }
        const fitAllowed = new Set([
          'cover',
          'contain',
          'fill',
          'none',
          'scale-down',
        ]);
        const nextItems: unknown[] = [];
        for (const row of items) {
          if (!row || typeof row !== 'object' || Array.isArray(row)) {
            throw new HttpError(400,
              '미디어 플레이리스트 항목 형식이 올바르지 않습니다.',
            );
          }
          const it = row as Record<string, unknown>;
          if (typeof it.id !== 'string' || it.id.length > 80) {
            throw new HttpError(400,
              '미디어 플레이리스트 항목 id가 올바르지 않습니다.',
            );
          }
          if (it.kind === 'image') {
            const normSrc = this.normalizeBookMediaElementSrc(it.src);
            if (normSrc == null) {
              throw new HttpError(400,
                '미디어 플레이리스트 이미지 src가 올바르지 않습니다.',
              );
            }
            if (it.durationSec != null) {
              const ds = it.durationSec;
              if (
                typeof ds !== 'number' ||
                !Number.isInteger(ds) ||
                ds < 1 ||
                ds > 600
              ) {
                throw new HttpError(400,
                  '이미지 표시 시간(durationSec)은 1~600 정수(초)여야 합니다.',
                );
              }
            }
            if (it.objectFit != null) {
              if (
                typeof it.objectFit !== 'string' ||
                !fitAllowed.has(it.objectFit)
              ) {
                throw new HttpError(400,
                  '미디어 플레이리스트 objectFit 값이 올바르지 않습니다.',
                );
              }
            }
            nextItems.push({
              ...it,
              src: normSrc,
            });
          } else if (it.kind === 'video') {
            const normSrc = this.normalizeBookMediaElementSrc(it.src);
            if (normSrc == null) {
              throw new HttpError(400,
                '미디어 플레이리스트 동영상 src가 올바르지 않습니다.',
              );
            }
            let posterSrc: string | null = null;
            const ps = it.posterSrc;
            if (ps != null && ps !== '') {
              const normPs = this.normalizeBookVideoPosterSrc(ps);
              if (normPs == null) {
                throw new HttpError(400,
                  '미디어 플레이리스트 posterSrc가 올바르지 않습니다.',
                );
              }
              posterSrc = normPs;
            }
            if (it.objectFit != null) {
              if (
                typeof it.objectFit !== 'string' ||
                !fitAllowed.has(it.objectFit)
              ) {
                throw new HttpError(400,
                  '미디어 플레이리스트 objectFit 값이 올바르지 않습니다.',
                );
              }
            }
            nextItems.push({
              ...it,
              src: normSrc,
              posterSrc,
            });
          } else {
            throw new HttpError(400,
              '미디어 플레이리스트 항목 kind는 image 또는 video여야 합니다.',
            );
          }
        }
        o.mediaPlaylistItems = nextItems as typeof items;
        if (
          o.mediaPlaylistLoop != null &&
          typeof o.mediaPlaylistLoop !== 'boolean'
        ) {
          throw new HttpError(400,
            'mediaPlaylistLoop은 true 또는 false여야 합니다.',
          );
        }
        if (
          o.mediaPlaylistShowControls != null &&
          typeof o.mediaPlaylistShowControls !== 'boolean'
        ) {
          throw new HttpError(400,
            'mediaPlaylistShowControls은 true 또는 false여야 합니다.',
          );
        }
      } else if (o.type === 'shape') {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 10 ||
          h < 10 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new HttpError(400,'도형 크기가 올바르지 않습니다.');
        }
        const allowed = new Set([
          'rect',
          'roundRect',
          'ellipse',
          'line',
          'triangle',
          'rightTriangle',
          'arrow',
          'chevron',
          'star',
          'diamond',
          'hexagon',
          'pentagon',
          'octagon',
          'trapezoid',
          'parallelogram',
          'ring',
          'blockArc',
          'plus',
          'cross',
        ]);
        if (typeof o.shapeKind !== 'string' || !allowed.has(o.shapeKind)) {
          throw new HttpError(400,'도형 종류가 올바르지 않습니다.');
        }
        if (typeof o.fill !== 'string' || o.fill.length > 40) {
          throw new HttpError(400,'도형 fill 색이 올바르지 않습니다.');
        }
        if (/[<>]/.test(o.fill) || /url\s*\(/i.test(o.fill)) {
          throw new HttpError(400,
            '도형 fill에 허용되지 않는 문자가 있습니다.',
          );
        }
        if (typeof o.stroke !== 'string' || o.stroke.length > 40) {
          throw new HttpError(400,'도형 stroke 색이 올바르지 않습니다.');
        }
        if (/[<>]/.test(o.stroke) || /url\s*\(/i.test(o.stroke)) {
          throw new HttpError(400,
            '도형 stroke에 허용되지 않는 문자가 있습니다.',
          );
        }
        const sw = o.strokeWidth;
        if (
          typeof sw !== 'number' ||
          sw < 0 ||
          sw > 32 ||
          !Number.isFinite(sw)
        ) {
          throw new HttpError(400,
            '도형 strokeWidth가 올바르지 않습니다.',
          );
        }
        if (
          (o.shapeKind === 'rect' || o.shapeKind === 'roundRect') &&
          o.cornerRadius != null
        ) {
          const cr = o.cornerRadius;
          if (
            typeof cr !== 'number' ||
            !Number.isFinite(cr) ||
            cr < 0 ||
            cr > 200
          ) {
            throw new HttpError(400,
              '도형 cornerRadius가 올바르지 않습니다.',
            );
          }
        }
      } else if (o.type === 'drawing') {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 8 ||
          h < 8 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new HttpError(400,
            '그리기 요소 크기가 올바르지 않습니다.',
          );
        }
        const pts = o.points;
        if (!Array.isArray(pts)) {
          throw new HttpError(400,'그리기 points가 올바르지 않습니다.');
        }
        if (pts.length < 4 || pts.length > 4096 || pts.length % 2 !== 0) {
          throw new HttpError(400,
            '그리기 points 길이가 올바르지 않습니다.',
          );
        }
        for (const v of pts) {
          if (typeof v !== 'number' || !Number.isFinite(v)) {
            throw new HttpError(400,'그리기 좌표가 올바르지 않습니다.');
          }
        }
        if (typeof o.stroke !== 'string' || o.stroke.length > 40) {
          throw new HttpError(400,
            '그리기 stroke 색이 올바르지 않습니다.',
          );
        }
        if (/[<>]/.test(o.stroke) || /url\s*\(/i.test(o.stroke)) {
          throw new HttpError(400,
            '그리기 stroke에 허용되지 않는 문자가 있습니다.',
          );
        }
        const sw = o.strokeWidth;
        if (
          typeof sw !== 'number' ||
          sw < 1 ||
          sw > 32 ||
          !Number.isFinite(sw)
        ) {
          throw new HttpError(400,
            '그리기 strokeWidth가 올바르지 않습니다.',
          );
        }
      } else {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 10 ||
          h < 10 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new HttpError(400,
            '이미지·비디오 크기가 올바르지 않습니다.',
          );
        }
        const normSrc = this.normalizeBookMediaElementSrc(o.src);
        if (normSrc == null) {
          throw new HttpError(400,'미디어 src가 올바르지 않습니다.');
        }
        o.src = normSrc;
        if (o.type === 'video') {
          const ps = o.posterSrc;
          if (ps != null && ps !== '') {
            const normPs = this.normalizeBookVideoPosterSrc(ps);
            if (normPs == null) {
              throw new HttpError(400,'posterSrc가 올바르지 않습니다.');
            }
            o.posterSrc = normPs;
          } else {
            o.posterSrc = null;
          }
        }
        if (o.objectFit != null) {
          const allowed = new Set([
            'cover',
            'contain',
            'fill',
            'none',
            'scale-down',
          ]);
          if (typeof o.objectFit !== 'string' || !allowed.has(o.objectFit)) {
            throw new HttpError(400,'objectFit 값이 올바르지 않습니다.');
          }
        }
      }
      if (o.borderRadius != null) {
        if (
          typeof o.borderRadius !== 'number' ||
          !Number.isFinite(o.borderRadius) ||
          o.borderRadius < 0 ||
          o.borderRadius > 2000
        ) {
          throw new HttpError(400,
            '요소 borderRadius가 올바르지 않습니다.',
          );
        }
      }
      if (o.outlineWidth != null) {
        if (
          typeof o.outlineWidth !== 'number' ||
          !Number.isFinite(o.outlineWidth) ||
          o.outlineWidth < 0 ||
          o.outlineWidth > 32
        ) {
          throw new HttpError(400,
            '요소 outlineWidth가 올바르지 않습니다.',
          );
        }
      }
      if (o.outlineColor != null) {
        if (
          typeof o.outlineColor !== 'string' ||
          o.outlineColor.length > 80 ||
          /[<>]/.test(o.outlineColor) ||
          /url\s*\(/i.test(o.outlineColor)
        ) {
          throw new HttpError(400,
            '요소 outlineColor가 올바르지 않습니다.',
          );
        }
      }
      if (o.opacity != null) {
        if (
          typeof o.opacity !== 'number' ||
          !Number.isFinite(o.opacity) ||
          o.opacity < 0 ||
          o.opacity > 1
        ) {
          throw new HttpError(400,
            '요소 opacity는 0 이상 1 이하 숫자여야 합니다.',
          );
        }
      }
      if (o.rotation != null) {
        if (
          typeof o.rotation !== 'number' ||
          !Number.isFinite(o.rotation) ||
          o.rotation < -360 ||
          o.rotation > 360
        ) {
          throw new HttpError(400,
            '요소 rotation은 -360~360 도 사이여야 합니다.',
          );
        }
      }
    }
  }

  private normalizePageBackgroundColor(raw: unknown): string {
    if (raw == null || raw === '') return '#ffffff';
    if (typeof raw !== 'string') {
      throw new HttpError(400,'backgroundColor는 문자열이어야 합니다.');
    }
    const s = raw.trim();
    if (s.length === 0) return '#ffffff';
    if (s.length > 64) {
      throw new HttpError(400,'배경색 값이 너무 깁니다.');
    }
    if (/[<>]/.test(s) || /url\s*\(/i.test(s)) {
      throw new HttpError(400,'허용되지 않는 배경색입니다.');
    }
    return s;
  }

  private normalizeBookSlideSize(
    widthRaw: unknown,
    heightRaw: unknown,
  ): { width: number; height: number } {
    const w =
      typeof widthRaw === 'number' && Number.isFinite(widthRaw)
        ? widthRaw
        : DEFAULT_PAGE_W;
    const h =
      typeof heightRaw === 'number' && Number.isFinite(heightRaw)
        ? heightRaw
        : DEFAULT_PAGE_H;
    if (w < 100 || w > 4000 || h < 100 || h > 4000) {
      throw new HttpError(400,
        '슬라이드 크기(너비·높이)가 올바르지 않습니다.',
      );
    }
    return { width: w, height: h };
  }

  private assertTimingElementIdOnPage(
    elements: unknown[],
    timingId: string,
  ): void {
    const ids = new Set<string>();
    for (const el of elements) {
      if (!el || typeof el !== 'object') continue;
      const id = (el as Record<string, unknown>).id;
      if (typeof id === 'string') ids.add(id);
    }
    if (!ids.has(timingId)) {
      throw new HttpError(400,
        '슬라이드쇼 시간 기준 요소 id가 해당 페이지의 요소에 없습니다.',
      );
    }
  }

  private normalizePagesInput(pages: BookPageInputDto[] | undefined): Array<{
    sortOrder: number;
    name: string;
    backgroundColor: string;
    elements: unknown[];
    presentationTimingElementId: string | null;
    presentationTransition: string;
    presentationTransitionMs: number;
  }> {
    if (pages == null || pages.length === 0) {
      return [
        {
          sortOrder: 0,
          name: '',
          backgroundColor: '#ffffff',
          elements: [],
          presentationTimingElementId: null,
          presentationTransition: DEFAULT_PRESENTATION_TRANSITION,
          presentationTransitionMs: DEFAULT_PRESENTATION_TRANSITION_MS,
        },
      ];
    }
    if (pages.length > MAX_PAGES) {
      throw new HttpError(400,`페이지는 최대 ${MAX_PAGES}장까지입니다.`);
    }
    const sorted = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (typeof p.sortOrder !== 'number' || !Number.isFinite(p.sortOrder)) {
        throw new HttpError(400,'sortOrder가 올바르지 않습니다.');
      }
      if (p.name != null) {
        if (typeof p.name !== 'string' || p.name.length > PAGE_NAME_MAX) {
          throw new HttpError(400,
            `페이지 이름은 ${PAGE_NAME_MAX}자 이하여야 합니다.`,
          );
        }
      }
      const elements = p.elements ?? [];
      this.validateElements(elements);
      this.normalizePageBackgroundColor(p.backgroundColor);
    }
    return sorted.map((p) => {
      const elements = p.elements ?? [];
      let presentationTimingElementId: string | null = null;
      const tr = p.presentationTimingElementId;
      if (tr != null && String(tr).trim() !== '') {
        const tid = String(tr).trim().slice(0, 80);
        this.assertTimingElementIdOnPage(elements, tid);
        presentationTimingElementId = tid;
      }
      return {
        sortOrder: p.sortOrder,
        name:
          typeof p.name === 'string'
            ? p.name.trim().slice(0, PAGE_NAME_MAX)
            : '',
        backgroundColor: this.normalizePageBackgroundColor(p.backgroundColor),
        elements,
        presentationTimingElementId,
        presentationTransition: normalizeBookPagePresentationTransition(
          p.presentationTransition,
        ),
        presentationTransitionMs: normalizeBookPagePresentationTransitionMs(
          p.presentationTransitionMs,
        ),
      };
    });
  }

  async findPage(
    skip: number,
    take: number,
    search?: string,
  ): Promise<{ items: BookListItemPublic[]; total: number }> {
    const db = this.db();
    const term = search?.trim().slice(0, 120);
    const whereClause = term ? like(bookTable.title, `%${term}%`) : undefined;

    const totalResult = await db
      .select({ n: count() })
      .from(bookTable)
      .where(whereClause);
    const total = Number(totalResult[0]?.n ?? 0);

    const rows = await db.query.book.findMany({
      where: whereClause,
      with: { author: true },
      orderBy: [desc(bookTable.updatedAt)],
      limit: take,
      offset: skip,
    });

    const ids = rows.map((r) => r.id);
    const countMap = new Map<number, number>();
    const firstPageByBookId = new Map<number, BookPageRow>();
    if (ids.length > 0) {
      const raw = await db
        .select({
          bookId: bookPage.bookId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(bookPage)
        .where(inArray(bookPage.bookId, ids))
        .groupBy(bookPage.bookId);
      for (const r of raw) {
        countMap.set(r.bookId, r.cnt);
      }

      const orderedPages = await db
        .select()
        .from(bookPage)
        .where(inArray(bookPage.bookId, ids))
        .orderBy(asc(bookPage.sortOrder), asc(bookPage.id));
      for (const p of orderedPages) {
        if (!firstPageByBookId.has(p.bookId))
          firstPageByBookId.set(p.bookId, p);
      }
    }

    const items: BookListItemPublic[] = rows.map((b) => {
      const fp = firstPageByBookId.get(b.id);
      let coverPreview: BookListCoverPreviewPublic | null = null;
      if (fp) {
        try {
          const elements = this.parseElementsJson(fp.elementsJson || "[]");
          coverPreview = {
            slideWidth: b.slideWidth ?? DEFAULT_PAGE_W,
            slideHeight: b.slideHeight ?? DEFAULT_PAGE_H,
            backgroundColor: fp.backgroundColor?.trim() || "#ffffff",
            elements,
          };
        } catch {
          coverPreview = {
            slideWidth: b.slideWidth ?? DEFAULT_PAGE_W,
            slideHeight: b.slideHeight ?? DEFAULT_PAGE_H,
            backgroundColor: fp.backgroundColor?.trim() || "#ffffff",
            elements: [],
          };
        }
      }
      return {
        id: b.id,
        title: b.title,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        author: this.mapAuthor(b.author),
        pageCount: countMap.get(b.id) ?? 0,
        coverPreview,
      };
    });

    return { items, total };
  }

  async findOne(id: number): Promise<BookPublic> {
    const db = this.db();
    const book = await db.query.book.findFirst({
      where: eq(bookTable.id, id),
      with: {
        author: true,
        pages: { orderBy: [asc(bookPage.sortOrder), asc(bookPage.id)] },
      },
    });
    if (!book) throw new HttpError(404, "북을 찾을 수 없습니다.");

    const pages = book.pages ?? [];

    return {
      id: book.id,
      title: book.title,
      slideWidth: book.slideWidth ?? DEFAULT_PAGE_W,
      slideHeight: book.slideHeight ?? DEFAULT_PAGE_H,
      presentationLoop: book.presentationLoop !== false,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      author: this.mapAuthor(book.author),
      pages: pages.map((p) => ({
        id: p.id,
        sortOrder: p.sortOrder,
        name: p.slideName ?? "",
        backgroundColor: p.backgroundColor?.trim() || "#ffffff",
        elements: this.parseElementsJson(p.elementsJson || "[]"),
        presentationTimingElementId: p.presentationTimingElementId ?? null,
        presentationTransition: normalizeBookPagePresentationTransition(
          p.presentationTransition,
        ),
        presentationTransitionMs: normalizeBookPagePresentationTransitionMs(
          p.presentationTransitionMs,
        ),
      })),
    };
  }

  async create(userId: number, body: CreateBookDto): Promise<BookPublic> {
    const db = this.db();
    const title = body.title?.trim() ?? "";
    if (!title) throw new HttpError(400, "제목을 입력하세요.");
    if (title.length > TITLE_MAX) {
      throw new HttpError(400, `제목은 ${TITLE_MAX}자 이하입니다.`);
    }

    const normalized = this.normalizePagesInput(body.pages);
    const { width: sw, height: sh } = this.normalizeBookSlideSize(
      body.slideWidth,
      body.slideHeight,
    );

    const [newBook] = await db
      .insert(bookTable)
      .values({
        title,
        authorId: userId,
        slideWidth: sw,
        slideHeight: sh,
        presentationLoop: body.presentationLoop !== false,
      })
      .returning();
    if (!newBook) throw new HttpError(500, "북 생성에 실패했습니다.");

    for (const p of normalized) {
      const elements = p.elements ?? [];
      this.validateElements(elements);
      await db.insert(bookPage).values({
        bookId: newBook.id,
        sortOrder: p.sortOrder,
        slideName: p.name,
        backgroundColor: p.backgroundColor,
        elementsJson: JSON.stringify(elements),
        presentationTimingElementId: p.presentationTimingElementId,
        presentationTransition: p.presentationTransition,
        presentationTransitionMs: p.presentationTransitionMs,
      });
    }

    return this.findOne(newBook.id);
  }

  async update(
    bookId: number,
    actor: AuthActor,
    body: UpdateBookDto,
  ): Promise<BookPublic> {
    const db = this.db();
    const book = await db.query.book.findFirst({
      where: eq(bookTable.id, bookId),
      with: { author: true },
    });
    if (!book) throw new HttpError(404, "북을 찾을 수 없습니다.");
    if (!canMutateOwnedResource(actor, book.author.id)) {
      throw new HttpError(403, "수정 권한이 없습니다.");
    }

    if (body.title != null) {
      const title = body.title.trim();
      if (!title) throw new HttpError(400, "제목을 입력하세요.");
      if (title.length > TITLE_MAX) {
        throw new HttpError(400, `제목은 ${TITLE_MAX}자 이하입니다.`);
      }
      await db
        .update(bookTable)
        .set({ title, updatedAt: new Date() })
        .where(eq(bookTable.id, bookId));
    }

    if (body.slideWidth != null || body.slideHeight != null) {
      const { width, height } = this.normalizeBookSlideSize(
        body.slideWidth ?? book.slideWidth ?? DEFAULT_PAGE_W,
        body.slideHeight ?? book.slideHeight ?? DEFAULT_PAGE_H,
      );
      await db
        .update(bookTable)
        .set({ slideWidth: width, slideHeight: height, updatedAt: new Date() })
        .where(eq(bookTable.id, bookId));
    }

    if (body.presentationLoop != null) {
      await db
        .update(bookTable)
        .set({
          presentationLoop: Boolean(body.presentationLoop),
          updatedAt: new Date(),
        })
        .where(eq(bookTable.id, bookId));
    }

    if (body.pages != null) {
      const normalized = this.normalizePagesInput(body.pages);
      await db.delete(bookPage).where(eq(bookPage.bookId, bookId));
      for (const p of normalized) {
        const elements = p.elements ?? [];
        this.validateElements(elements);
        await db.insert(bookPage).values({
          bookId,
          sortOrder: p.sortOrder,
          slideName: p.name,
          backgroundColor: p.backgroundColor,
          elementsJson: JSON.stringify(elements),
          presentationTimingElementId: p.presentationTimingElementId,
          presentationTransition: p.presentationTransition,
          presentationTransitionMs: p.presentationTransitionMs,
        });
      }
    }

    return this.findOne(bookId);
  }

  async remove(bookId: number, actor: AuthActor): Promise<void> {
    const db = this.db();
    const book = await db.query.book.findFirst({
      where: eq(bookTable.id, bookId),
      with: { author: true },
    });
    if (!book) throw new HttpError(404, "북을 찾을 수 없습니다.");
    if (!canMutateOwnedResource(actor, book.author.id)) {
      throw new HttpError(403, "삭제 권한이 없습니다.");
    }
    await db.delete(bookPage).where(eq(bookPage.bookId, bookId));
    await db.delete(bookTable).where(eq(bookTable.id, bookId));
  }

  async assertBookOwner(bookId: number, actor: AuthActor) {
    const db = this.db();
    const b = await db.query.book.findFirst({
      where: eq(bookTable.id, bookId),
      with: { author: true },
    });
    if (!b) throw new HttpError(404, "북을 찾을 수 없습니다.");
    if (!canMutateOwnedResource(actor, b.author.id)) {
      throw new HttpError(403, "업로드 권한이 없습니다.");
    }
    return b;
  }

  mapUploadedFile(file: { filename: string; mimetype: string }): {
    kind: "image" | "video";
    url: string;
  } {
    const imageMime = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
    const videoMime = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
    if (imageMime.has(file.mimetype)) {
      return { kind: 'image', url: this.imagePublicUrl(file.filename) };
    }
    if (videoMime.has(file.mimetype)) {
      return { kind: 'video', url: this.videoPublicUrl(file.filename) };
    }
    throw new HttpError(400,'지원하지 않는 파일 형식입니다.');
  }

  mapPosterFile(file: { filename: string }): string {
    return this.posterPublicUrl(file.filename);
  }
}
