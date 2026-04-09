import DOMPurify from "dompurify";
import type { Config } from "dompurify";

const DISPLAY_PURIFY: Config = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "s",
    "strike",
    "del",
    "u",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "a",
    "hr",
    "span",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "style"],
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

/** 서버 정제 후에도 이중 방어용(표시 전) */
export function sanitizePostHtmlForDisplay(html: string): string {
  return String(DOMPurify.sanitize(html, DISPLAY_PURIFY));
}

export function looksLikeStoredRichHtml(s: string): boolean {
  return /^\s*<(p|div|h[1-6]|ul|ol|blockquote|pre)\b/i.test(s.trim());
}

/** 구버전 순수 텍스트 본문 → 안전한 단락 HTML */
export function legacyPlainToDisplayHtml(raw: string): string {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped
    .split("\n")
    .map((line) => `<p>${line.length > 0 ? line : "<br />"}</p>`)
    .join("");
}

/** 상세·미리보기용: 리치/플레인 모두 처리 후 정제 */
export function postBodyHtmlForRender(raw: string): string {
  const trimmed = raw.trim();
  const source = looksLikeStoredRichHtml(trimmed)
    ? raw
    : legacyPlainToDisplayHtml(raw);
  return sanitizePostHtmlForDisplay(source);
}

export function plainTextFromPostHtml(html: string): string {
  if (typeof document === "undefined") {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent || "").replace(/\s+/g, " ").trim();
}
