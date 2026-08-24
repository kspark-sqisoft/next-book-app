/**
 * 텍스트 위젯 애니메이션 — 식별자·기본값·글자/단어 분할·CSS 변수 계산.
 * 실제 키프레임은 `src/book-text-animations.css`, 적용은 `BookTextAnimatedContent`.
 * 새 효과 추가: 아래 IDS·META·OPTIONS·CSS·백엔드 화이트리스트(`books.service.ts`)를 함께 수정.
 */

export const BOOK_TEXT_ANIMATION_IDS = [
  "none",
  "typewriter",
  "fadeIn",
  "slideUp",
  "zoomIn",
  "blurIn",
  "charPop",
  "wordFade",
  "wave",
  "marquee",
  "scrollUp",
] as const;

export type BookTextAnimationId = (typeof BOOK_TEXT_ANIMATION_IDS)[number];

/** block = 위젯 전체, char = 글자(자소) 단위, word = 공백 기준 단어 단위 */
export type BookTextAnimationUnit = "block" | "char" | "word";

export type BookTextAnimationMeta = {
  unit: BookTextAnimationUnit;
  /** true면 무한 반복(시간 = 한 사이클), false면 1회(시간 = 완료까지) */
  loop: boolean;
  defaultDurationSec: number;
  /**
   * 글자·단어 효과에서 단위 하나의 애니메이션 길이(초).
   * wave는 인접 글자 간 위상 간격. 블록 효과는 0.
   */
  unitDurationSec: number;
};

export const BOOK_TEXT_ANIMATION_META: Record<
  BookTextAnimationId,
  BookTextAnimationMeta
> = {
  none: {
    unit: "block",
    loop: false,
    defaultDurationSec: 0,
    unitDurationSec: 0,
  },
  typewriter: {
    unit: "char",
    loop: false,
    defaultDurationSec: 3,
    unitDurationSec: 0,
  },
  fadeIn: {
    unit: "block",
    loop: false,
    defaultDurationSec: 0.8,
    unitDurationSec: 0,
  },
  slideUp: {
    unit: "block",
    loop: false,
    defaultDurationSec: 0.8,
    unitDurationSec: 0,
  },
  zoomIn: {
    unit: "block",
    loop: false,
    defaultDurationSec: 0.8,
    unitDurationSec: 0,
  },
  blurIn: {
    unit: "block",
    loop: false,
    defaultDurationSec: 0.9,
    unitDurationSec: 0,
  },
  charPop: {
    unit: "char",
    loop: false,
    defaultDurationSec: 1.2,
    unitDurationSec: 0.45,
  },
  wordFade: {
    unit: "word",
    loop: false,
    defaultDurationSec: 1.2,
    unitDurationSec: 0.5,
  },
  wave: {
    unit: "char",
    loop: true,
    defaultDurationSec: 2,
    unitDurationSec: 0.08,
  },
  marquee: {
    unit: "block",
    loop: true,
    defaultDurationSec: 10,
    unitDurationSec: 0,
  },
  scrollUp: {
    unit: "block",
    loop: true,
    defaultDurationSec: 12,
    unitDurationSec: 0,
  },
};

export const BOOK_TEXT_ANIMATION_OPTIONS: {
  id: BookTextAnimationId;
  label: string;
}[] = [
  { id: "none", label: "없음 (정적)" },
  { id: "typewriter", label: "타이프라이터" },
  { id: "fadeIn", label: "페이드 인" },
  { id: "slideUp", label: "슬라이드 업" },
  { id: "zoomIn", label: "줌 인" },
  { id: "blurIn", label: "블러 인" },
  { id: "charPop", label: "글자 팝 (순차)" },
  { id: "wordFade", label: "단어 페이드 (순차)" },
  { id: "wave", label: "웨이브 (반복)" },
  { id: "marquee", label: "가로 스크롤 (반복)" },
  { id: "scrollUp", label: "세로 스크롤 (반복)" },
];

export const BOOK_TEXT_ANIMATION_MIN_SEC = 0.2;
export const BOOK_TEXT_ANIMATION_MAX_SEC = 120;

/** 글자·단어 span이 이보다 많으면 분할하지 않음(DOM·애니메이션 부하 방지) → 블록 페이드로 폴백 */
export const MAX_BOOK_TEXT_ANIMATION_UNITS = 800;

export function isBookTextAnimationId(s: string): s is BookTextAnimationId {
  return (BOOK_TEXT_ANIMATION_IDS as readonly string[]).includes(s);
}

export function normalizeBookTextAnimation(raw: unknown): BookTextAnimationId {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (isBookTextAnimationId(s)) return s;
  return "none";
}

export function clampBookTextAnimationDurationSec(
  raw: unknown,
  id: BookTextAnimationId,
): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (raw == null || !Number.isFinite(n)) {
    return BOOK_TEXT_ANIMATION_META[id].defaultDurationSec;
  }
  const clamped = Math.min(
    BOOK_TEXT_ANIMATION_MAX_SEC,
    Math.max(BOOK_TEXT_ANIMATION_MIN_SEC, n),
  );
  return Math.round(clamped * 100) / 100;
}

export type ResolvedBookTextAnimation = {
  id: BookTextAnimationId;
  durationSec: number;
};

export function resolveBookTextAnimation(el: {
  textAnimation?: unknown;
  textAnimationDurationSec?: unknown;
}): ResolvedBookTextAnimation {
  const id = normalizeBookTextAnimation(el.textAnimation);
  if (id === "none") return { id, durationSec: 0 };
  return {
    id,
    durationSec: clampBookTextAnimationDurationSec(
      el.textAnimationDurationSec,
      id,
    ),
  };
}

/* ───────── 글자·단어 분할 ───────── */

const CJK_RE =
  /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const WHITESPACE_ONLY_RE = /^\s+$/;

function segmentGraphemes(text: string): string[] {
  const Seg = (
    Intl as unknown as {
      Segmenter?: new (
        locale: string,
        opts: { granularity: "grapheme" },
      ) => { segment(s: string): Iterable<{ segment: string }> };
    }
  ).Segmenter;
  if (Seg) {
    const out: string[] = [];
    for (const s of new Seg("ko", { granularity: "grapheme" }).segment(text)) {
      out.push(s.segment);
    }
    return out;
  }
  return Array.from(text);
}

/** 공백 덩어리를 경계로 나누되 공백도 항목으로 남김(줄바꿈 보존) */
function splitKeepWhitespace(text: string): string[] {
  return text.split(/(\s+)/).filter((s) => s.length > 0);
}

function countUnits(texts: string[], unit: "char" | "word"): number {
  let n = 0;
  for (const t of texts) {
    for (const chunk of splitKeepWhitespace(t)) {
      if (WHITESPACE_ONLY_RE.test(chunk)) continue;
      n += unit === "word" ? 1 : segmentGraphemes(chunk).length;
    }
  }
  return n;
}

function makeUnitSpan(doc: Document, text: string, index: number): HTMLElement {
  const span = doc.createElement("span");
  span.className = "bta-u";
  span.setAttribute("style", `--i:${index}`);
  span.textContent = text;
  return span;
}

/**
 * 살균된 HTML의 텍스트 노드만 글자/단어 span으로 감쌉니다(서식 태그·공백은 그대로).
 * - char: 자소 단위 `<span class="bta-u" style="--i:N">`. 한글·CJK가 없는 여러 글자 단어는
 *   `<span class="bta-w">`로 묶어 단어 중간 줄바꿈을 막습니다(CJK는 원래대로 글자 사이 줄바꿈 허용).
 * - word: 공백 기준 단어마다 `<span class="bta-u">` 하나.
 * 단위 수가 `MAX_BOOK_TEXT_ANIMATION_UNITS`를 넘거나 DOM이 없으면 원본 그대로·count 0.
 */
export function buildAnimatedTextHtml(
  html: string,
  unit: "char" | "word",
): { html: string; count: number } {
  if (typeof document === "undefined" || typeof DOMParser === "undefined") {
    return { html, count: 0 };
  }
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="bta-root">${html}</div>`,
      "text/html",
    );
    const root = doc.getElementById("bta-root");
    if (!root) return { html, count: 0 };

    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      textNodes.push(n as Text);
    }
    const total = countUnits(
      textNodes.map((t) => t.data),
      unit,
    );
    if (total === 0 || total > MAX_BOOK_TEXT_ANIMATION_UNITS) {
      return { html, count: 0 };
    }

    let index = 0;
    for (const textNode of textNodes) {
      const parent = textNode.parentNode;
      if (!parent) continue;
      const frag = doc.createDocumentFragment();
      for (const chunk of splitKeepWhitespace(textNode.data)) {
        if (WHITESPACE_ONLY_RE.test(chunk)) {
          frag.appendChild(doc.createTextNode(chunk));
          continue;
        }
        if (unit === "word") {
          frag.appendChild(makeUnitSpan(doc, chunk, index++));
          continue;
        }
        const graphemes = segmentGraphemes(chunk);
        const wrapWord = graphemes.length > 1 && !CJK_RE.test(chunk);
        const target = wrapWord ? doc.createElement("span") : frag;
        if (wrapWord) (target as HTMLElement).className = "bta-w";
        for (const g of graphemes) {
          target.appendChild(makeUnitSpan(doc, g, index++));
        }
        if (wrapWord) frag.appendChild(target);
      }
      parent.replaceChild(frag, textNode);
    }
    return { html: root.innerHTML, count: index };
  } catch {
    return { html, count: 0 };
  }
}

/* ───────── CSS 변수 ───────── */

function fmtSec(n: number): string {
  return `${Number(Math.max(0, n).toFixed(4))}s`;
}

/**
 * 효과·총 시간·단위 수 → 인라인 CSS 변수.
 * - `--bta-dur`: 블록 효과 길이 / 반복 효과 한 사이클
 * - `--bta-step`: 단위 간 지연 간격
 * - `--bta-unit`: 단위 하나의 애니메이션 길이
 */
export function textAnimationCssVars(
  id: BookTextAnimationId,
  durationSec: number,
  count: number,
): Record<string, string> {
  const meta = BOOK_TEXT_ANIMATION_META[id];
  const d = Math.max(0, durationSec);
  if (id === "typewriter") {
    const step = d / Math.max(1, count);
    return {
      "--bta-dur": fmtSec(d),
      "--bta-step": fmtSec(step),
      "--bta-unit": fmtSec(step),
    };
  }
  if (id === "wave") {
    return {
      "--bta-dur": fmtSec(d),
      "--bta-step": fmtSec(meta.unitDurationSec),
    };
  }
  if (meta.unit === "char" || meta.unit === "word") {
    const unit = meta.unitDurationSec;
    const step = Math.max(0, d - unit) / Math.max(1, count - 1);
    return {
      "--bta-dur": fmtSec(d),
      "--bta-step": fmtSec(step),
      "--bta-unit": fmtSec(unit),
    };
  }
  return { "--bta-dur": fmtSec(d) };
}
