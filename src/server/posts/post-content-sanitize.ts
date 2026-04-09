import sanitizeHtml from "sanitize-html";

const ALIGN = /^(left|right|center|justify)$/;
/** TipTap 글자색: hex / rgb / rgba / hsl — url·expression 차단 */
const COLOR_STYLE = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
  /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
  /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/i,
  /^hsla\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
];
const FONT_SIZE_STYLE = [
  /^\d{1,3}(\.\d+)?px$/i,
  /^\d{1,2}(\.\d+)?rem$/i,
  /^\d{1,2}(\.\d+)?em$/i,
];

/** 클라이언트(TipTap)에서 온 HTML을 저장 전에 정제합니다. */
export function sanitizePostContentHtml(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: [
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
    allowedAttributes: {
      span: ["style"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      h5: ["style"],
      h6: ["style"],
      a: ["href", "target", "rel"],
    },
    allowedStyles: {
      "*": {
        "text-align": [ALIGN],
      },
      span: {
        color: COLOR_STYLE,
        "font-size": FONT_SIZE_STYLE,
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });
}

export function postContentPlainLength(html: string): number {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}
