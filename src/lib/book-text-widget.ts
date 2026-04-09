/**
 * 텍스트 위젯(슬라이드)용 리치 HTML — 저장·표시 전 정제 및 평문 동기화.
 * 다른 위젯 타입이 늘어나도 텍스트 전용 로직은 이 모듈에 모읍니다.
 */

import DOMPurify from "dompurify";
import type { BookCanvasElement } from "@/lib/book-canvas";

const BOOK_TEXT_RICH_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "strike",
  "del",
  "u",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
  "a",
  "span",
] as const;

/**
 * `span`의 style에서 `color`·`font-size`만 허용합니다. (다른 CSS·XSS 벡터 차단)
 * 글자 크기는 위젯 루트 `fontSize`에 대한 `em`을 권장합니다.
 */
function isSafeFontSizeValue(val: string): boolean {
  const v = val.trim();
  if (!v || v.length > 24) return false;
  if (/[;{}]|url\s*\(|expression\s*\(|@import/i.test(v)) return false;
  const em = /^(\d+(\.\d+)?)em$/i.exec(v);
  if (em) {
    const n = parseFloat(em[1]!);
    return Number.isFinite(n) && n >= 0.5 && n <= 4;
  }
  const px = /^(\d+)px$/i.exec(v);
  if (px) {
    const n = parseInt(px[1]!, 10);
    return Number.isFinite(n) && n >= 8 && n <= 128;
  }
  return false;
}

/** p·제목·인용·목록 항목 등에 허용하는 style — text-align만 (TipTap TextAlign·contentEditable 공통) */
export function sanitizeBlockTextAlignStyle(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(";").map((x) => x.trim()).filter(Boolean);
  for (const part of parts) {
    const m = /^text-align\s*:\s*(.+)$/i.exec(part);
    if (!m) continue;
    const val = m[1]!.trim().toLowerCase();
    if (
      val === "left" ||
      val === "center" ||
      val === "right" ||
      val === "justify" ||
      val === "start" ||
      val === "end"
    ) {
      return `text-align: ${val}`;
    }
  }
  return null;
}

const BLOCK_TAGS_ALLOW_TEXT_ALIGN = new Set([
  "p",
  "h2",
  "h3",
  "blockquote",
  "li",
]);

function sanitizeSpanStyle(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(";").map((x) => x.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    const colorM = /^color\s*:\s*(.+)$/i.exec(part);
    if (colorM) {
      const val = colorM[1]!.trim();
      if (isSafeCssColorValue(val)) kept.push(`color: ${val}`);
      continue;
    }
    const fsM = /^font-size\s*:\s*(.+)$/i.exec(part);
    if (fsM) {
      const val = fsM[1]!.trim();
      if (isSafeFontSizeValue(val)) kept.push(`font-size: ${val}`);
      continue;
    }
  }
  if (kept.length === 0) return null;
  return kept.join("; ");
}

function isSafeCssColorValue(val: string): boolean {
  const v = val.trim();
  if (v.length > 120) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return true;
  if (/^rgba?\(\s*[\d.\s%,]+\)$/i.test(v)) return true;
  if (/^hsla?\(\s*[\d.\s%,]+\)$/i.test(v)) return true;
  if (/[;{}]|url\s*\(|expression\s*\(|@import/i.test(v)) return false;
  if (/^[a-z][a-z0-9\s-]*$/i.test(v)) return true;
  return false;
}

function bookRichHtmlPostProcessStyle(html: string): string {
  if (typeof document === "undefined") return html;
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const wrap = doc.body.firstElementChild as HTMLDivElement | null;
    if (!wrap) return html;
    wrap.querySelectorAll("[style]").forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const raw = el.getAttribute("style") || "";
      if (tag === "span") {
        const next = sanitizeSpanStyle(raw);
        if (next) el.setAttribute("style", next);
        else el.removeAttribute("style");
        return;
      }
      if (BLOCK_TAGS_ALLOW_TEXT_ALIGN.has(tag)) {
        const next = sanitizeBlockTextAlignStyle(raw);
        if (next) el.setAttribute("style", next);
        else el.removeAttribute("style");
        return;
      }
      el.removeAttribute("style");
    });
    return wrap.innerHTML;
  } catch {
    return html;
  }
}

/** TipTap 등에서 나온 HTML을 저장·innerHTML 전에 한 번 더 거릅니다. */
export function sanitizeBookRichHtml(dirty: string): string {
  const pass = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [...BOOK_TEXT_RICH_ALLOWED_TAGS],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
    ALLOW_DATA_ATTR: false,
  });
  return bookRichHtmlPostProcessStyle(pass);
}

/**
 * contentEditable(Chromium 등)이 Enter로 넣는 `<div>`는 허용 태그가 아니라 살균 시 줄이 한 덩어리로 무너집니다.
 * 안쪽부터 `<p>`로 바꿉니다.
 */
export function normalizeContentEditableHtmlForBook(html: string): string {
  if (typeof document === "undefined") return html;
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="book-ce-normalize-root">${html}</div>`,
      "text/html",
    );
    const root = doc.getElementById("book-ce-normalize-root");
    if (!root) return html;
    const divs = Array.from(root.querySelectorAll("div")).reverse();
    for (const div of divs) {
      const p = doc.createElement("p");
      const st = div.getAttribute("style");
      if (st) {
        const alignOnly = sanitizeBlockTextAlignStyle(st);
        if (alignOnly) p.setAttribute("style", alignOnly);
      }
      while (div.firstChild) p.appendChild(div.firstChild);
      div.parentNode?.replaceChild(p, div);
    }
    return root.innerHTML;
  } catch {
    return html;
  }
}

/** 캔버스 인라인 편집 종료 시: div→p 정규화 후 살균 */
export function bookRichHtmlFromContentEditable(raw: string): string {
  return sanitizeBookRichHtml(normalizeContentEditableHtmlForBook(raw));
}

export function escapeHtmlPlain(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 썸네일·폴백용 평문 (최대 길이는 API `text` 제한과 맞춤). */
export function richHtmlToPlainText(html: string, maxLen = 8000): string {
  if (typeof document === "undefined") {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLen);
  }
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function getTextWidgetDisplayHtml(
  el: Extract<BookCanvasElement, { type: "text" }>,
): string {
  const rich = el.richHtml?.trim();
  if (rich) return sanitizeBookRichHtml(rich);
  const t = el.text ?? "";
  if (!t.trim()) return sanitizeBookRichHtml("<p></p>");
  return sanitizeBookRichHtml(`<p>${escapeHtmlPlain(t)}</p>`);
}

export function defaultTextWidgetBoxHeight(fontSize: number): number {
  return Math.max(40, Math.ceil(fontSize * 1.35 * 3));
}

export function textWidgetHitHeight(
  el: Extract<BookCanvasElement, { type: "text" }>,
): number {
  if (typeof el.height === "number" && el.height >= 24) return el.height;
  return defaultTextWidgetBoxHeight(el.fontSize);
}

/**
 * 캔버스 오버레이 측정값으로 높이를 바꿀 때: 사용자·변형으로 키운 박스는 줄이지 않음(창 확대·축소 시 축소 방지).
 * 내용이 더 길어질 때만 새 높이를 반환, 그 외 null.
 */
export function nextTextWidgetHeightGrowOnly(
  measuredLogical: number,
  currentHeight: number | undefined,
  fontSize: number,
): number | null {
  const next = Math.max(28, Math.min(4000, Math.ceil(measuredLogical)));
  const prev =
    typeof currentHeight === "number" &&
    Number.isFinite(currentHeight) &&
    currentHeight >= 24
      ? currentHeight
      : defaultTextWidgetBoxHeight(fontSize);
  if (next <= prev + 2) return null;
  return next;
}

/** 인라인 편집 커밋 등: 측정 높이와 기존 높이 중 더 큰 값으로 유지 */
export function mergeTextWidgetHeightAfterMeasure(
  measuredLogical: number,
  currentHeight: number | undefined,
  fontSize: number,
): number {
  const m = Math.max(28, Math.min(4000, Math.ceil(measuredLogical)));
  const prev =
    typeof currentHeight === "number" &&
    Number.isFinite(currentHeight) &&
    currentHeight >= 24
      ? currentHeight
      : defaultTextWidgetBoxHeight(fontSize);
  return Math.max(m, prev);
}
