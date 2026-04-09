import { asc, eq } from "drizzle-orm";
import type { AuthActor } from "@/server/auth/auth-policy";
import { getDb } from "@/server/db";
import { bookAiChatMessage } from "@/server/db/schema";
import { HttpError } from "@/server/http/http-error";
import { BOOK_AI_USER_GUIDE_BLOCK } from "./book-ai-user-guide";
import { BooksService } from "./books.service";
import { PexelsService } from "./pexels.service";

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const ANCHORS = new Set([
  'topLeft',
  'topCenter',
  'topRight',
  'middleLeft',
  'center',
  'middleRight',
  'bottomLeft',
  'bottomCenter',
  'bottomRight',
]);

const WIDGETS = new Set([
  'weather',
  'digitalClock',
  'news',
  'text',
  'image',
  'video',
]);

export type BookLayoutAiAddWidgetAction = {
  type: 'add_widget';
  widget: 'weather' | 'digitalClock' | 'news' | 'text' | 'image' | 'video';
  anchor: string;
  /** 왼쪽 목록 기준 1번째 슬라이드에 배치. 생략 시 «현재 보고 있는» 슬라이드 */
  slideNumber?: number;
  cityQuery?: string;
  text?: string;
  /** 텍스트 위젯 글자 크기(px), 대략 14~96 */
  fontSize?: number;
  /** Pexels 검색어(영어 키워드 권장). 서버가 이미지 URL로 치환 */
  imageSearchQuery?: string;
  /** 사용자가 준 직접 https 이미지 URL */
  imageUrl?: string;
  /** Pexels 동영상 검색(영어). 서버가 짧은 MP4·포스터 URL로 치환 */
  videoSearchQuery?: string;
  /** 사용자가 준 직접 https 동영상 URL */
  videoUrl?: string;
  /** 서버가 Pexels 등으로 채움 — 클라이언트는 이 값으로 이미지·동영상 위젯 생성 */
  src?: string;
  /** 동영상 썸네일(https 또는 업로드 경로는 클라이언트 저장 시 정규화) */
  posterSrc?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
  /** 네 값 모두 있으면 슬라이드 논리 좌표(px)로 박스 지정 — anchor·스택 오프셋보다 우선(격자·시간표) */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

/** 선택된 이미지·비디오 위젯의 src만 교체(같은 id·위치 유지). 클라이언트가 selection을 보낸 경우에만 유효 */
export type BookLayoutAiReplaceWidgetMediaAction = {
  type: 'replace_widget_media';
  elementId: string;
  widget: 'image' | 'video';
  imageSearchQuery?: string;
  imageUrl?: string;
  videoSearchQuery?: string;
  videoUrl?: string;
  src?: string;
  posterSrc?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
};

export type BookLayoutAiSetBackgroundAction = {
  type: 'set_page_background';
  backgroundColor: string;
};

export type BookLayoutAiSetPageTitleAction = {
  type: 'set_page_title';
  title: string;
  /** 왼쪽 목록 기준 1번째 슬라이드 = 1. 생략 시 «현재 보고 있는» 슬라이드 */
  slideNumber?: number;
};

/** 워크스페이스 상단 «북» 문서 제목(책 전체). 슬라이드 탭 이름과 다름. */
export type BookLayoutAiSetBookTitleAction = {
  type: 'set_book_title';
  title: string;
};

/** 맨 뒤에 빈 슬라이드 추가. count 생략 시 1. */
export type BookLayoutAiAddPageAction = {
  type: 'add_page';
  count?: number;
};

export type BookLayoutAiUndoAction = { type: 'undo' };
export type BookLayoutAiRedoAction = { type: 'redo' };
/** 보고 있는 슬라이드 삭제 — UI에서 확인 창을 띄움. 페이지가 1장뿐이면 삭제 안 됨. */
export type BookLayoutAiRemoveCurrentPageAction = {
  type: 'remove_current_page';
};

/** 북 전체 슬라이드 캔버스 해상도(px). 헤더 «캔버스» W/H와 동일. */
export type BookLayoutAiSetSlideDimensionsAction = {
  type: 'set_slide_dimensions';
  slideWidth?: number;
  slideHeight?: number;
};

export type BookLayoutAiAction =
  | BookLayoutAiAddWidgetAction
  | BookLayoutAiReplaceWidgetMediaAction
  | BookLayoutAiSetBackgroundAction
  | BookLayoutAiSetPageTitleAction
  | BookLayoutAiSetBookTitleAction
  | BookLayoutAiAddPageAction
  | BookLayoutAiUndoAction
  | BookLayoutAiRedoAction
  | BookLayoutAiRemoveCurrentPageAction
  | BookLayoutAiSetSlideDimensionsAction;

export type BookLayoutAiResult = {
  reply: string;
  actions: BookLayoutAiAction[];
};

export class BookAiService {
  private static readonly CHAT_PAGE = 200;

  private readonly pexels = new PexelsService();
  private readonly booksService = new BooksService();

  private db() {
    return getDb();
  }

  async interpretLayoutIntent(input: {
    message: string;
    slideWidth: number;
    slideHeight: number;
    /** 전체 슬라이드(페이지) 수 — 번호 해석에 사용 */
    pageCount: number;
    /** 현재 보고 있는 슬라이드, 0-based */
    activeSlideIndex: number;
    /** 단일 이미지·비디오 선택 시 — «바꿔줘» 등은 replace_widget_media로 */
    selection?: { elementId: string; kind: 'image' | 'video' };
  }): Promise<BookLayoutAiResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new HttpError(503,
        'OPENAI_API_KEY가 설정되지 않았습니다. 백엔드 .env에 키를 추가하세요.',
      );
    }

    const model =
      process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    const msg = input.message?.trim();
    if (!msg || msg.length > 4000) {
      throw new HttpError(400,'message는 1~4000자여야 합니다.');
    }

    const w = input.slideWidth;
    const h = input.slideHeight;
    if (!Number.isFinite(w) || w < 100 || w > 4096) {
      throw new HttpError(400,'slideWidth가 올바르지 않습니다.');
    }
    if (!Number.isFinite(h) || h < 100 || h > 4096) {
      throw new HttpError(400,'slideHeight가 올바르지 않습니다.');
    }

    const pageCount = Math.floor(Number(input.pageCount));
    const activeIdx = Math.floor(Number(input.activeSlideIndex));
    if (!Number.isFinite(pageCount) || pageCount < 1 || pageCount > 500) {
      throw new HttpError(400,'pageCount는 1~500이어야 합니다.');
    }
    if (
      !Number.isFinite(activeIdx) ||
      activeIdx < 0 ||
      activeIdx >= pageCount
    ) {
      throw new HttpError(400,'activeSlideIndex가 올바르지 않습니다.');
    }
    const viewingOneBased = activeIdx + 1;

    const sel = input.selection;
    const selectionBlock = sel
      ? `WIDGET SELECTION (single selected widget on the slide the user is viewing): elementId="${sel.elementId}" kind="${sel.kind}". If they ask to change/replace/swap THIS widget's image or video (e.g. 바꿔줘, 다른 걸로, 교체, 다른 동영상, 다른 사진, replace, swap, change to), emit replace_widget_media (schema J) with this EXACT elementId and widget "${sel.kind}" plus English imageSearchQuery/videoSearchQuery or https URL. Do NOT use add_widget for that. If the request is about book title, slide tab name, background, pages, undo, canvas size, or unrelated topics, ignore this selection.`
      : 'No WIDGET SELECTION — never emit replace_widget_media (no target id). Use add_widget for new image/video widgets.';

    const system = `You are a layout assistant for a Korean slide/book editor. Respond ONLY with one JSON object (no markdown).

Schema:
{
  "reply": "brief Korean summary for the user",
  "actions": [ action, ... ]
}

Each action is ONE of:

A) Add a widget:
{
  "type": "add_widget",
  "widget": "weather" | "digitalClock" | "news" | "text" | "image" | "video",
  "anchor": "topLeft" | "topCenter" | "topRight" | "middleLeft" | "center" | "middleRight" | "bottomLeft" | "bottomCenter" | "bottomRight",
  "cityQuery": "optional — weather only, e.g. Seoul,KR",
  "text": "optional — exact text for text widget when user gave wording",
  "fontSize": optional number 18-72 for text widget default ~28,
  "imageSearchQuery": "for widget image only, when no URL — ENGLISH Pexels photo keywords (see Rules).",
  "imageUrl": "optional — direct https image URL for widget image (omit imageSearchQuery)",
  "videoSearchQuery": "for widget video only, when no URL — ENGLISH Pexels video keywords. Server picks a short clip (~25s max), smallest quality for smaller file size. Example: "스위스 풍경 짧은 동영상" → "Switzerland landscape nature scenic short".",
  "videoUrl": "optional — direct https video URL for widget video (omit videoSearchQuery)",
  "slideNumber": "optional integer 1..N — ONLY when the user EXPLICITLY names a slide by number/ordinal (e.g. "슬라이드 2에", "3번째 페이지", "1장에 넣어"). For add_widget (image, video, text, weather, clock, news): DEFAULT is ALWAYS the slide they are currently viewing — OMIT slideNumber if they did not specify which slide (e.g. "이미지 넣어줘", "스위스 사진", "비디오 추가" alone).",
  "x": "optional number — left edge in slide px (must use with y, width, height)",
  "y": "optional number — top edge in slide px",
  "width": "optional number — box width px",
  "height": "optional number — box height px"
}
When "x", "y", "width", and "height" are ALL numbers, the widget is placed in that rectangle and anchor-based stacking is skipped (use for grids, school timetables, weekly boards). Otherwise "anchor" is required as before. For explicit-box rows you may set anchor to "topLeft" as a placeholder.

B) Set slide background:
{
  "type": "set_page_background",
  "backgroundColor": "CSS color e.g. #0f172a or rgb(15,23,42)"
}

C) Rename one slide's tab name (left sidebar). In this app "slide" and "page" are the same. Slides are numbered 1 to N from the TOP of the left list (slide 1 = first row).
{
  "type": "set_page_title",
  "title": "short slide name",
  "slideNumber": optional integer 1..N — use when the user names a specific slide: "슬라이드 1번", "첫 번째 슬라이드", "1장", "두 번째 페이지" → 2, etc.
}
Omit slideNumber ONLY when they clearly mean the slide they are currently viewing (e.g. "이 슬라이드 이름", "지금 페이지 제목", "현재 장") with no other slide index.

D) Rename the whole book document (top header title of the book, NOT a single slide):
{
  "type": "set_book_title",
  "title": "book title"
}

E) Add blank slide(s) at the END of the book (new empty pages):
{
  "type": "add_page",
  "count": optional integer 1-5 (default 1)
}

F) Undo last edit(s) (same as Ctrl+Z):
{ "type": "undo" }
You may repeat undo multiple times by including several undo actions in order.

G) Redo (same as Ctrl+Y / Ctrl+Shift+Z):
{ "type": "redo" }
You may repeat redo multiple times.

H) Delete the CURRENT slide/page the user is viewing — the app will show a confirmation dialog; if only one page exists, deletion is blocked:
{ "type": "remove_current_page" }

I) Set slide canvas resolution in pixels (book-wide; same as header canvas W × H). Include at least one of slideWidth or slideHeight (integers 100-4000):
{
  "type": "set_slide_dimensions",
  "slideWidth": optional,
  "slideHeight": optional
}
Examples: Full HD → 1920 and 1080; HD → 1280 and 720; default-like → 960 and 540; square post → 1080 and 1080.

J) Replace the picture or clip inside ONE existing image/video widget (keeps position and size). ONLY when the user message includes WIDGET SELECTION with elementId and kind — use that EXACT elementId and matching widget kind:
{
  "type": "replace_widget_media",
  "elementId": "same string as WIDGET SELECTION",
  "widget": "image" | "video" — must equal WIDGET SELECTION kind,
  "imageSearchQuery" | "imageUrl" for widget image (same rules as add_widget image),
  "videoSearchQuery" | "videoUrl" for widget video (same rules as add_widget video)
}
No anchor, no slideNumber. When the user wants different media for the selected widget (Korean: 바꿔줘, 다른 걸로, 교체, 다른 동영상/사진; English: replace, swap, change to), use J) NOT add_widget — add_widget would create a second widget.

${BOOK_AI_USER_GUIDE_BLOCK}

Rules:
- Map Korean requests: 날씨/날씨 위젯/○○ 날씨 → weather with cityQuery (e.g. Seoul,KR, Busan,KR, Tokyo,JP). 디지털 시계/전자시계/시계 위젯 → digitalClock (no cityQuery). 뉴스/헤드라인/속보 위젯 → news (no extra fields; server uses NewsAPI headlines).
- TEXT widget on the CANVAS (슬라이드 안 글 상자) — NOT the slide tab name and NOT the book header title:
  - If the user gives exact wording to show on the slide, use add_widget widget "text" and set "text" to that EXACT string (Korean preserved).
  - Korean patterns meaning "put this string in a text box": 「…」/『…』 … 넣어줘; "…" 란/이라는/라는 텍스트(를) 넣어줘; … 란/이라는/라는 문구·글자; 텍스트 위젯에 『…』 넣어줘.
  - Examples: "안녕하세요 란 텍스트를 넣어줘" → add_widget text, text: "안녕하세요", anchor center. "『환영합니다』 문구 추가" → text: "환영합니다".
  - Do NOT use set_page_title or set_book_title for these — those only rename the slide tab or the whole book document, they do not create a visible text box on the slide.
- CRITICAL — image vs video disambiguation in Korean: If the user says 비디오 OR 동영상 OR 영상 in the sense of a moving video clip (e.g. "스위스 풍경 비디오", "풍경 영상 넣어줘", "짧은 영상", "영상 클립"), you MUST use widget "video" with videoSearchQuery (English), NEVER widget "image". The word 풍경 alone does NOT mean image; paired with 비디오/동영상/영상 it is still a VIDEO request.
- IMAGE requests (이미지/사진/그림/포토/배경화면 사진 등 — only when they do NOT ask for video as above): ALWAYS emit add_widget with widget "image". If no https URL from user, you MUST set imageSearchQuery to rich ENGLISH keywords (never Korean in imageSearchQuery). Translate places: 스위스=Switzerland, 일본=Japan, 파리=Paris, 제주=Jeju island Korea. Combine place + scene + quality words (landscape, scenic, beautiful, nature, aerial, sunset, etc.). Default anchor "center" unless user asks for a corner.
- VIDEO requests (동영상/비디오/영상/클립/짧은 영상/MP4 등): ALWAYS emit add_widget with widget "video". If no https URL from user, you MUST set videoSearchQuery to rich ENGLISH keywords (never Korean). Example: "스위스 풍경 비디오" → videoSearchQuery: "Switzerland landscape nature scenic mountains aerial b-roll". The server searches Pexels videos and prefers short clips and smaller MP4 files. Same anchor rules as image.
- Anchors: 좌상단=topLeft, 상단중앙=topCenter, 우상단=topRight, 왼쪽중앙=middleLeft, 정중앙=center, 오른쪽중앙=middleRight, 좌하=bottomLeft, 하단중앙=bottomCenter, 우하=bottomRight. Default center for "넣어줘" without position.
- add_widget slideNumber — DEFAULT: place on the CURRENTLY VIEWED slide (the UI selection). Set slideNumber ONLY when the user clearly targets another slide by index or ordinal (e.g. 슬라이드 2, 2번째 페이지, 1장에, 세 번째 슬이드, page 3). If they only ask to add/change an image or video without naming which slide, NEVER set slideNumber (even if you guess a number). Same for text/weather/clock/news widgets unless they name a slide.
- For image: imageSearchQuery must be English only, 4–12 words typically, specific enough to match the user's intent. If user provides https URL, use imageUrl only and omit imageSearchQuery.
- For video: videoSearchQuery must be English only. If user provides a direct https link to a video file, use videoUrl only and omit videoSearchQuery.
- VERY IMPORTANT — book vs slide title in Korean:
  - Use set_book_title when the user means the ENTIRE book/presentation name: "북 이름", "북 제목", "책 제목", "이 북 이름", "프레젠테이션 제목", "문서 제목", "워크스페이스 상단 제목", "저장할 제목" (the main title bar).
  - Use set_page_title for ONE slide/tab in the left list. Include slideNumber (1-based) when they specify which slide: "슬라이드 1번 제목을 …로", "첫 번째 페이지 이름", "2장 제목을 …". First in list = slideNumber 1.
  - Omit slideNumber on set_page_title only for the currently viewed slide when they say e.g. "이 슬라이드", "지금 페이지", "현재 장" with no ordinal/number.
  - If ambiguous bare "제목 바꿔줘" with a new name and no slide index, prefer set_book_title (book title is the common default).
- Use add_page when user asks to create/add slides or pages: "슬라이드 추가", "페이지 만들어줘", "새 장", "빈 슬라이드", "페이지 두 개 더". Put add_page BEFORE add_widget if widgets belong on the NEW slide.
- Use undo for 되돌리기/취소/Ctrl+Z/방금 한 거 취소/한 단계 되돌려. Use redo for 다시 실행/다시 해/복원. Multiple "두 번 되돌려" → several undo actions in order.
- Use remove_current_page for 이 페이지 지워줘/현재 슬라이드 삭제/이 장 없애줘. Mention in reply that user must confirm in the dialog; if only one slide, say 삭제할 수 없음.
- Use set_slide_dimensions for 해상도/캔버스 크기/슬라이드 크기(px)/FHD/풀HD/HD/4K/정사각형 등. Map common names to pixels (e.g. FHD 1920×1080). If user changes only width or height, emit only that field.
- When WIDGET SELECTION is in the user message and the user wants different image/video for that selection, emit replace_widget_media (J) with the given elementId — not add_widget.
- NEVER return "actions": [] when the user clearly asks to add a widget (image, video, text, weather, clock, news), replace selected image/video media, change layout on the current slide, build a **structured layout** (강의시간표·수업표·교시표·주간 표·격자), or asks you to **compose a digital signage / display screen** (디지털 사이니지, 전광판, 키오스크·매장 화면, 메뉴보드, 안내판, 프로모 배너 등) — always emit the matching action(s).
- **Digital signage & public display screens** — Triggers include: 디지털 사이니지, 사이니지 화면, 전광판, 키오스크, 매장 표시, 메뉴보드, 오늘의 메뉴, 가격표, 프로모·할인 배너, 공지·휴무 안내판, 로비 안내, 층 안내, 행사 포스터, 매장 홍보 화면, "이런 식의 화면", "간판처럼", 영문: digital signage, menu board, lobby display, promo board, etc. The user expects you to **build the whole slide** from widgets (like a template, but you output actions). **Never** answer with only description and empty actions.
  - Start with **set_page_background** when it helps readability: dark menu boards #0f172a / #1e293b; warm cafe #fffbeb / #fff7ed; clean notice #f8fafc; urgent #fef2f2 / #fff1f2; promo #ecfdf5 / #f0fdf4.
  - Use **many add_widget "text"** with **x, y, width, height** (slide px) for: full-width **title band**, section headers (COFFEE / FOOD / DESSERT, or 공지 / 운영안내), price lines, bullet lists, footer (영업시간 · 전화 · 문의). fontSize: main title **28–42**, section **20–28**, body **16–24**, small print **14–18**. Prefer **high contrast** text on background (#f8fafc on dark, #0f172a on light).
  - Add **add_widget "image"** with **imageSearchQuery** (English only) when a hero product/food/ambience photo fits—use **explicit x,y,width,height** so it sits in a reserved zone (e.g. left 38% for photo, right for menu), or top banner. Example queries: "latte coffee cup cafe", "burger meal restaurant", "shopping mall interior lobby".
  - Add **digitalClock** (anchor topRight) and/or **weather** (anchor topLeft, cityQuery e.g. Seoul,KR) for lobby / building directory style if the user hints 실시간·날씨·시계 or outdoor board.
  - Add **news** if they want headline-style ticker on the board.
  - **set_page_title** with a short sidebar label (e.g. "1F 메뉴", "휴무공지").
  - If copy is vague, invent plausible **Korean** placeholder lines (메뉴명·가격·할인 조건·유의사항). Use \\n in text for stacked lines in one box.
  - Typical **16:9** layout: margin **18–28px**; top **title row** ~56–88px height; body split **40/60** or **50/50** for image vs text; bottom **footer strip** ~36–52px.
  - **Menu board**: 2-column price list or category blocks; optional "BEST" line; 원산지 표기 안내 한 줄.
  - **Notice board**: 큰 제목 + 본문 블록 + 연락처.
  - **Promo**: 큰 숫자/할인율 + 기간 + 장소/조건.
  - Keep total actions **≤ 60**. In reply, say they can edit text, replace images, or use the Templates tab for more presets; existing widgets may overlap—undo or clear slide first if needed.
- **Timetable / grid on this slide** (e.g. "이 페이지에 학교 강의실 시간표", "수업 시간표 만들어줘", class schedule, period grid): You MUST emit multiple add_widget "text" actions, each with **x, y, width, height** (all numbers) in **slide pixels** for every cell (headers + periods + optional title row). Use the canvas size given in the user message below. Margins ~20–32px; title bar ~48–72px tall; column headers (월–금 or 요일) ~36–52px tall; time/교시 label column ~72–100px wide; body cells ~40–56px tall unless canvas is large. fontSize ~14–20 in cells, ~24–32 for main title. Optional set_page_background e.g. #f8fafc. You may use \\n inside "text" for two lines in one cell. Placeholder content is OK (과목명, 교실, 담당 등) if the user did not specify. Keep total actions ≤ 60. In reply, note that existing widgets may overlap — user can undo or clear the slide first.
- **User guide / 기능 안내** — If the user asks how this site or book editor works (e.g. 지원 파일 형식, 업로드 용량, 슬라이드쇼·전환 효과, 미리보기 URL, 템플릿, 위젯 종류, 저장, 단축키, 한도, Pexels/뉴스/날씨가 어떻게 동작하는지, "뭐 할 수 있어?", "어떻게 해?") **without** asking you to change the slide in the same message: answer in **reply** with clear, accurate **Korean** using **only** the Reference block above plus the action schema you already know. Use **actions: []**. If they both ask a how-to question **and** request an edit in one message, answer in reply **and** emit the appropriate actions.
- You may combine actions (e.g. background + many text cells + image + clock). Keep at most 60 actions.
- **True off-topic** (일반 상식·시사만, 타 서비스, 수학/코딩 숙제, 이 편집기와 무관한 농담/상담 등): ALWAYS actions: []. In "reply", Korean only: this assistant focuses on **this** slide/book editor; the request is outside scope. Brief wit/wordplay allowed as before—kind, 1–3 short sentences, never rude. Do not invent product facts.`;

    const user = `This book has ${pageCount} slide(s) (same as "pages"), numbered 1–${pageCount} from the first item in the left sidebar list. The user is now viewing slide ${viewingOneBased} (1-based).
Slide canvas size: ${w}px wide × ${h}px tall (origin top-left; all explicit x,y,width,height for add_widget must fit inside this rectangle).

${selectionBlock}

User request:
${msg}`;

    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch (e) {
      console.warn(`OpenAI fetch failed: ${(e as Error).message}`);
      throw new HttpError(503,'OpenAI 연결에 실패했습니다.');
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`OpenAI HTTP ${res.status}: ${errText.slice(0, 500)}`);
      throw new HttpError(503,
        'OpenAI 요청이 거절되었거나 오류가 났습니다.',
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new HttpError(503,'모델 응답이 비어 있습니다.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new HttpError(503,'모델 JSON 파싱에 실패했습니다.');
    }

    const preliminary = this.normalizeLayoutResult(
      parsed,
      input.selection,
      w,
      h,
    );
    if (preliminary.actions.length === 0) {
      console.warn(
        '[layout-ai] 모델이 actions=[] 만 돌려줌 — 폴백·보정으로 채울 수 있으면 이어서 처리',
      );
    }
    preliminary.actions = this.coerceImageActionsToVideoWhenUserAskedVideo(
      msg,
      preliminary.actions,
    );
    preliminary.actions = this.ensureVideoWidgetWhenUserAskedButNoVideoAction(
      msg,
      preliminary.actions,
      input.selection,
    );
    preliminary.actions = this.ensureTextWidgetWithLiteralFromUserMessage(
      msg,
      preliminary.actions,
    );
    preliminary.actions = this.ensureReplaceWidgetMediaWhenSelected(
      msg,
      preliminary.actions,
      input.selection,
    );
    preliminary.actions =
      this.dropAddWidgetSlideNumberUnlessUserSpecifiedTargetSlide(
        msg,
        preliminary.actions,
        viewingOneBased,
      );
    const enriched = await this.enrichActions(preliminary);
    this.logLayoutAiResponseDigest(msg, enriched, viewingOneBased);
    return enriched;
  }

  /** 터미널에서 비디오 실패 원인(Pexels·src 누락) 추적용 */
  private logLayoutAiResponseDigest(
    userMessage: string,
    result: BookLayoutAiResult,
    viewingOneBased: number,
  ): void {
    const preview =
      userMessage.length > 100 ? `${userMessage.slice(0, 100)}…` : userMessage;
    const adds = result.actions.filter(
      (a): a is BookLayoutAiAddWidgetAction => a.type === 'add_widget',
    );
    const replaces = result.actions.filter(
      (a): a is BookLayoutAiReplaceWidgetMediaAction =>
        a.type === 'replace_widget_media',
    );
    const videos = adds.filter((a) => a.widget === 'video');
    const hasHttpsSrc = (a: BookLayoutAiAddWidgetAction) =>
      typeof a.src === 'string' && /^https:\/\//i.test(a.src.trim());
    const replaceHttps = replaces.filter(
      (a) => typeof a.src === 'string' && /^https:\/\//i.test(a.src.trim()),
    );
    console.log(
      `[layout-ai] 응답 digest viewingSlide=${viewingOneBased} actions=${result.actions.length} add_widget=${adds.length} replace_widget_media=${replaces.length} replace_https_src=${replaceHttps.length} video=${videos.length} video_https_src=${videos.filter(hasHttpsSrc).length} user="${preview}"`,
    );
    videos.forEach((v, i) => {
      const ok = hasHttpsSrc(v);
      let host = '—';
      if (ok && v.src) {
        try {
          host = new URL(v.src).hostname;
        } catch {
          host = 'bad-url';
        }
      }
      console.log(
        `[layout-ai]   video[${i}] src=${ok ? 'OK' : 'MISSING'} host=${host} slideNumber=${v.slideNumber ?? 'omit'} anchor=${v.anchor}`,
      );
    });
  }

  /**
   * 사용자가 특정 슬라이드(번호·서수)를 말하지 않았는데 모델이 slideNumber를 넣는 경우
   * 현재 보는 슬라이드에 붙도록 제거합니다.
   */
  private userMessageSpecifiesTargetSlideIndex(userMessage: string): boolean {
    const s = userMessage.trim();
    if (!s) return false;
    return (
      /슬라이드\s*[:#]?\s*\d+/i.test(s) ||
      /\d+\s*번(째)?\s*(슬라이드|페이지|장)\b/.test(s) ||
      /\b[1-9]\d*\s*장(에|으로|만)?\b/.test(s) ||
      /(첫|두|세|네|다섯|여섯|일곱|여덟|아홉|열|열한|열두)\s*번째/.test(s) ||
      /페이지\s*[:#]?\s*\d+/i.test(s) ||
      /\d+\s*페이지(에|만)?\b/.test(s) ||
      /(맨\s*위|맨\s*아래|첫\s*장|마지막\s*(장|슬라이드|페이지))/.test(s) ||
      /\bslide\s*[:#]?\s*\d+/i.test(s)
    );
  }

  private dropAddWidgetSlideNumberUnlessUserSpecifiedTargetSlide(
    userMessage: string,
    actions: BookLayoutAiAction[],
    viewingOneBased: number,
  ): BookLayoutAiAction[] {
    if (this.userMessageSpecifiesTargetSlideIndex(userMessage)) {
      console.log(
        '[layout-ai] add_widget slideNumber 유지(사용자가 장 번호·서수 등으로 지정)',
      );
      return actions;
    }
    let stripped = 0;
    const next = actions.map((act) => {
      if (act.type !== 'add_widget' || act.slideNumber == null) return act;
      stripped += 1;
      const copy: BookLayoutAiAddWidgetAction = { ...act };
      delete copy.slideNumber;
      return copy;
    });
    if (stripped > 0) {
      console.log(
        `[layout-ai] add_widget slideNumber ${stripped}건 제거 → 현재 보는 슬라이드(${viewingOneBased}번) 기준`,
      );
    }
    return next;
  }

  /** 동영상 클립 요청(한·영). `넣어봐` 등 구어체 포함 */
  private userMessageAsksForVideoClip(m: string): boolean {
    const s = m.trim();
    if (!s) return false;
    return /비디오|동영상|영상\s*(?:을|를|이|가|만|도)?\s*(?:넣|추가|올려|줘|해주|해\s*줘|해|봐|보)|넣어\s*봐|넣어봐|영상\s*클립|짧은\s*영상|쇼츠|b-roll|broll|\bmp4\b|\bvideo\b/i.test(
      s,
    );
  }

  private userMessageWantsCanvasTextPlaced(m: string): boolean {
    return /넣어|넣어줘|추가|올려|배치|띄워|보여줘|표시해|써줘|써\s*주|작성|기입|만들어|생성해/i.test(
      m,
    );
  }

  private userMessageIsLikelySlideOrBookTitleRename(m: string): boolean {
    return /(슬라이드|페이지|장|탭|왼쪽\s*목록)\s*(이름|제목)|(북|책|문서)\s*제목|프레젠테이션\s*제목|워크스페이스\s*상단/i.test(
      m,
    );
  }

  private extractBracketQuotedTextForWidget(m: string): string | null {
    const s = m.trim();
    const q1 = /『([^』]{1,4000})』/.exec(s);
    if (q1) {
      const t = q1[1].trim();
      return t.length > 0 ? t.slice(0, 4000) : null;
    }
    const q2 = /「([^」]{1,4000})」/.exec(s);
    if (q2) {
      const t = q2[1].trim();
      return t.length > 0 ? t.slice(0, 4000) : null;
    }
    return null;
  }

  /**
   * "○○ 란 텍스트", "○○라는 문구" 등 — 문장 시작(또는 구분 뒤)부터 잡아 앞부분 잡음을 줄임.
   */
  private extractKoreanRanOrRaneunTextLiteral(m: string): string | null {
    const s = m.trim();
    const segment =
      /(?:^|[.!?。]\s*)(.{1,600}?)\s*(?:란|이라는|라는)\s+(?:텍스트|문구|글(?:자)?)(?:을|를)?/giu;
    let last: string | null = null;
    let mm: RegExpExecArray | null;
    while ((mm = segment.exec(s)) !== null) {
      const t = mm[1].replace(/\s+$/u, '').trim();
      if (t.length > 0) last = t.slice(0, 4000);
    }
    return last;
  }

  private resolveLiteralTextForTextWidgetIntent(m: string): string | null {
    const hasPlacement = this.userMessageWantsCanvasTextPlaced(m);
    const hasTextWidgetCue =
      /텍스트\s*위젯|글\s*상자|문구\s*박스|텍스트\s*박스/i.test(m);
    const quoted = this.extractBracketQuotedTextForWidget(m);
    if (quoted && (hasPlacement || hasTextWidgetCue)) return quoted;
    const ran = this.extractKoreanRanOrRaneunTextLiteral(m);
    if (ran && hasPlacement) return ran;
    return null;
  }

  /**
   * 모델이 텍스트 위젯을 빼먹거나 text 필드를 비운 경우(예: "안녕하세요 란 텍스트를 넣어줘").
   */
  private ensureTextWidgetWithLiteralFromUserMessage(
    userMessage: string,
    actions: BookLayoutAiAction[],
  ): BookLayoutAiAction[] {
    const m = userMessage.trim();
    if (!m) return actions;
    if (this.userMessageIsLikelySlideOrBookTitleRename(m)) return actions;

    const literal = this.resolveLiteralTextForTextWidgetIntent(m);
    if (!literal) return actions;

    const hasTextWithContent = actions.some(
      (a) =>
        a.type === 'add_widget' &&
        a.widget === 'text' &&
        Boolean(a.text?.trim()),
    );
    if (hasTextWithContent) return actions;

    const emptyIdx = actions
      .map((a, i) =>
        a.type === 'add_widget' && a.widget === 'text' && !a.text?.trim()
          ? i
          : -1,
      )
      .filter((i) => i >= 0);
    if (emptyIdx.length > 0) {
      console.warn(
        `[layout-ai] 텍스트 위젯 본문 폴백: 빈 text 위젯에 "${literal.slice(0, 60)}${literal.length > 60 ? '…' : ''}"`,
      );
      const fill = new Set(emptyIdx);
      return actions.map((a, i) => {
        if (!fill.has(i)) return a;
        if (a.type !== 'add_widget' || a.widget !== 'text') return a;
        return { ...a, text: literal };
      });
    }

    console.warn(
      `[layout-ai] 텍스트 위젯 폴백 add_widget text="${literal.slice(0, 60)}${literal.length > 60 ? '…' : ''}"`,
    );
    return [
      ...actions,
      {
        type: 'add_widget',
        widget: 'text',
        anchor: 'center',
        text: literal,
      },
    ];
  }

  /**
   * 모델이 actions=[] 이거나 video add_widget을 빼먹었을 때(예: "스위스 풍경 비디오 넣어봐"),
   * Pexels용 영어 검색어를 합성해 add_widget video를 한 개 붙입니다.
   */
  /** 선택 미디어 교체 의도(제목·배경 등과 구분) */
  private userMessageSuggestsMediaReplace(m: string): boolean {
    const s = m.trim();
    if (!s) return false;
    if (
      /제목|타이틀|북\s*제목|슬라이드\s*(이름|제목)|페이지\s*(이름|제목)|배경|해상도|캔버스\s*크기|되돌|취소|undo|redo/i.test(
        s,
      )
    ) {
      return false;
    }
    const hasReplaceCue =
      /바꿔|바꾸|교체|replace|swap|갈아|다른\s*걸|다른거|또\s*다른|change\s+(to|the|this|it)\b/i.test(
        s,
      );
    if (!hasReplaceCue) return false;
    const hasMediaCue =
      /이미지|사진|그림|비디오|동영상|영상|미디어|클립|photo|picture|video|clip|\bmp4\b|\bwebm\b/i.test(
        s,
      );
    if (hasMediaCue) return true;
    return s.length <= 18;
  }

  private ensureReplaceWidgetMediaWhenSelected(
    userMessage: string,
    actions: BookLayoutAiAction[],
    selection?: { elementId: string; kind: 'image' | 'video' },
  ): BookLayoutAiAction[] {
    if (!selection) return actions;
    const m = userMessage.trim();
    if (!m || !this.userMessageSuggestsMediaReplace(m)) return actions;

    const hasReplace = actions.some(
      (a) =>
        a.type === 'replace_widget_media' &&
        a.elementId === selection.elementId,
    );
    if (hasReplace) return actions;

    const hasMediaAdd = actions.some(
      (a) =>
        a.type === 'add_widget' &&
        (a.widget === 'image' || a.widget === 'video'),
    );
    if (hasMediaAdd) return actions;

    if (selection.kind === 'video') {
      const q = this.koreanToEnglishVideoStockQuery(m);
      if (!q) return actions;
      console.warn(
        `[layout-ai] 선택 비디오 교체 폴백 replace_widget_media videoSearchQuery="${q.slice(0, 80)}${q.length > 80 ? '…' : ''}"`,
      );
      return [
        ...actions,
        {
          type: 'replace_widget_media',
          elementId: selection.elementId,
          widget: 'video',
          videoSearchQuery: q,
        },
      ];
    }

    const q = this.koreanToEnglishPhotoStockQuery(m);
    if (!q) return actions;
    console.warn(
      `[layout-ai] 선택 이미지 교체 폴백 replace_widget_media imageSearchQuery="${q.slice(0, 80)}${q.length > 80 ? '…' : ''}"`,
    );
    return [
      ...actions,
      {
        type: 'replace_widget_media',
        elementId: selection.elementId,
        widget: 'image',
        imageSearchQuery: q,
      },
    ];
  }

  private ensureVideoWidgetWhenUserAskedButNoVideoAction(
    userMessage: string,
    actions: BookLayoutAiAction[],
    selection?: { elementId: string; kind: 'image' | 'video' },
  ): BookLayoutAiAction[] {
    const m = userMessage.trim();
    if (!m) return actions;
    if (
      selection?.kind === 'video' &&
      this.userMessageSuggestsMediaReplace(m)
    ) {
      return actions;
    }
    if (!this.userMessageAsksForVideoClip(m)) return actions;

    const askedImageAlso =
      /이미지|사진\s*넣|그림\s*넣|포토|photo|picture/i.test(m) &&
      /비디오|동영상|영상/i.test(m);
    if (askedImageAlso) return actions;

    const hasVideoIntentAction = actions.some(
      (a) =>
        a.type === 'add_widget' &&
        a.widget === 'video' &&
        (Boolean(a.videoSearchQuery?.trim()) || Boolean(a.videoUrl?.trim())),
    );
    if (hasVideoIntentAction) return actions;

    const q = this.koreanToEnglishVideoStockQuery(m);
    if (!q) return actions;

    console.warn(
      `[layout-ai] 비디오 요청인데 모델에 video 액션 없음 → 폴백 add_widget 합성 videoSearchQuery="${q.slice(0, 100)}${q.length > 100 ? '…' : ''}"`,
    );
    return [
      ...actions,
      {
        type: 'add_widget',
        widget: 'video',
        anchor: 'center',
        videoSearchQuery: q,
      },
    ];
  }

  /** Pexels video 검색용 짧은 영어 키워드(규칙 기반) */
  private koreanToEnglishVideoStockQuery(m: string): string {
    const parts: string[] = [];

    const tokens: [RegExp, string][] = [
      [/스위스|switzerland/i, 'Switzerland'],
      [/일본|japan/i, 'Japan'],
      [/제주|jeju/i, 'Jeju island Korea'],
      [/한국|korea(?!\s*bbq)/i, 'Korea'],
      [/파리|paris/i, 'Paris France'],
      [/미국|usa|america|뉴욕|new\s*york/i, 'USA'],
      [/유럽|europe/i, 'Europe'],
      [/바다|해양|파도|ocean|sea(?!\s*food)/i, 'ocean sea waves'],
      [/산|알프스|mountain|설산/i, 'mountains alpine'],
      [/숲|forest|woods/i, 'forest woods'],
      [/도시|city|urban|야경/i, 'city urban'],
      [/밤|night|야경/i, 'night'],
      [/눈|snow|겨울|winter/i, 'snow winter'],
      [/사막|desert/i, 'desert'],
      [/폭포|waterfall/i, 'waterfall'],
      [/드론|aerial|항공/i, 'aerial drone'],
    ];

    for (const [re, term] of tokens) {
      if (re.test(m) && !parts.includes(term)) parts.push(term);
    }

    if (/풍경|경치|자연|nature|landscape|scenic|뷰|전경/i.test(m)) {
      if (!parts.some((p) => /landscape|nature|scenic/i.test(p))) {
        parts.push('landscape nature scenic');
      }
    }

    if (parts.length === 0) {
      parts.push('beautiful nature scenic');
    }

    parts.push('b-roll short clip');
    const q = parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    return q;
  }

  /** Pexels photo 검색용 — 토큰은 비디오와 동일 계열 */
  private koreanToEnglishPhotoStockQuery(m: string): string {
    const parts: string[] = [];
    const tokens: [RegExp, string][] = [
      [/스위스|switzerland/i, 'Switzerland'],
      [/일본|japan/i, 'Japan'],
      [/제주|jeju/i, 'Jeju island Korea'],
      [/한국|korea(?!\s*bbq)/i, 'Korea'],
      [/파리|paris/i, 'Paris France'],
      [/미국|usa|america|뉴욕|new\s*york/i, 'USA'],
      [/유럽|europe/i, 'Europe'],
      [/바다|해양|파도|ocean|sea(?!\s*food)/i, 'ocean sea waves'],
      [/산|알프스|mountain|설산/i, 'mountains alpine'],
      [/숲|forest|woods/i, 'forest woods'],
      [/도시|city|urban|야경/i, 'city urban'],
      [/밤|night|야경/i, 'night'],
      [/눈|snow|겨울|winter/i, 'snow winter'],
      [/사막|desert/i, 'desert'],
      [/폭포|waterfall/i, 'waterfall'],
      [/드론|aerial|항공/i, 'aerial drone'],
    ];
    for (const [re, term] of tokens) {
      if (re.test(m) && !parts.includes(term)) parts.push(term);
    }
    if (/풍경|경치|자연|nature|landscape|scenic|뷰|전경/i.test(m)) {
      if (!parts.some((p) => /landscape|nature|scenic/i.test(p))) {
        parts.push('landscape nature scenic');
      }
    }
    if (parts.length === 0) {
      parts.push('beautiful nature scenic');
    }
    parts.push('high quality photo');
    return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  /**
   * 모델이 "풍경 비디오"를 이미지 위젯+검색어로 잘못 내는 경우 보정.
   * 이미지+동영상을 동시에 달라는 문장이면 자동 변환하지 않음.
   */
  private coerceImageActionsToVideoWhenUserAskedVideo(
    userMessage: string,
    actions: BookLayoutAiAction[],
  ): BookLayoutAiAction[] {
    const m = userMessage.trim();
    if (!m) return actions;

    if (!this.userMessageAsksForVideoClip(m)) return actions;

    const askedImageAlso =
      /이미지|사진\s*넣|그림\s*넣|포토|photo|picture/i.test(m) &&
      /비디오|동영상|영상/i.test(m);
    if (askedImageAlso) return actions;

    return actions.map((act) => {
      if (act.type !== 'add_widget') return act;
      if (act.widget !== 'image') return act;
      if (act.imageUrl?.trim()) return act;
      const q = act.imageSearchQuery?.trim();
      if (!q) return act;

      const next: BookLayoutAiAddWidgetAction = {
        type: 'add_widget',
        widget: 'video',
        anchor: act.anchor,
        videoSearchQuery: q,
      };
      if (act.slideNumber != null) next.slideNumber = act.slideNumber;
      if (act.cityQuery?.trim()) next.cityQuery = act.cityQuery;
      if (act.text?.trim()) next.text = act.text;
      if (act.fontSize != null) next.fontSize = act.fontSize;
      if (act.x != null) next.x = act.x;
      if (act.y != null) next.y = act.y;
      if (act.width != null) next.width = act.width;
      if (act.height != null) next.height = act.height;
      return next;
    });
  }

  private clampAiWidgetRect(
    x: number,
    y: number,
    width: number,
    height: number,
    slideW: number,
    slideH: number,
  ): { x: number; y: number; width: number; height: number } {
    const minW = 24;
    const minH = 16;
    let w = Math.round(width);
    let ht = Math.round(height);
    let xi = Math.round(x);
    let yi = Math.round(y);
    w = Math.min(slideW, Math.max(minW, w));
    ht = Math.min(slideH, Math.max(minH, ht));
    xi = Math.min(Math.max(0, xi), Math.max(0, slideW - w));
    yi = Math.min(Math.max(0, yi), Math.max(0, slideH - ht));
    return { x: xi, y: yi, width: w, height: ht };
  }

  private normalizeLayoutResult(
    parsed: unknown,
    selection?: { elementId: string; kind: 'image' | 'video' },
    slideW = 960,
    slideH = 540,
  ): BookLayoutAiResult {
    if (!parsed || typeof parsed !== 'object') {
      throw new HttpError(503,'모델 응답 형식이 잘못되었습니다.');
    }
    const o = parsed as Record<string, unknown>;
    const reply =
      typeof o.reply === 'string' && o.reply.trim()
        ? o.reply.trim().slice(0, 2000)
        : '처리했습니다.';
    const rawActions = o.actions;
    const actions: BookLayoutAiAction[] = [];
    if (Array.isArray(rawActions)) {
      for (const item of rawActions.slice(0, 60)) {
        if (!item || typeof item !== 'object') continue;
        const a = item as Record<string, unknown>;
        const t = a.type;

        if (t === 'set_page_background') {
          const bg = a.backgroundColor;
          if (typeof bg !== 'string') continue;
          const c = bg.trim().slice(0, 120);
          if (!c || /[<>]/.test(c)) continue;
          actions.push({ type: 'set_page_background', backgroundColor: c });
          continue;
        }

        if (t === 'set_page_title') {
          const title = a.title;
          if (typeof title !== 'string') continue;
          const s = title.trim().slice(0, 200);
          if (!s) continue;
          const act: BookLayoutAiSetPageTitleAction = {
            type: 'set_page_title',
            title: s,
          };
          if (
            typeof a.slideNumber === 'number' &&
            Number.isFinite(a.slideNumber)
          ) {
            const sn = Math.round(a.slideNumber);
            if (sn >= 1 && sn <= 500) act.slideNumber = sn;
          }
          actions.push(act);
          continue;
        }

        if (t === 'set_book_title') {
          const title = a.title;
          if (typeof title !== 'string') continue;
          const s = title.trim().slice(0, 200);
          if (!s) continue;
          actions.push({ type: 'set_book_title', title: s });
          continue;
        }

        if (t === 'add_page') {
          let c = 1;
          if (typeof a.count === 'number' && Number.isFinite(a.count)) {
            c = Math.floor(a.count);
            c = Math.min(10, Math.max(1, c));
          }
          actions.push({ type: 'add_page', count: c });
          continue;
        }

        if (t === 'undo') {
          actions.push({ type: 'undo' });
          continue;
        }

        if (t === 'redo') {
          actions.push({ type: 'redo' });
          continue;
        }

        if (t === 'remove_current_page') {
          actions.push({ type: 'remove_current_page' });
          continue;
        }

        if (t === 'set_slide_dimensions') {
          const sw = a.slideWidth;
          const sh = a.slideHeight;
          const hasW = typeof sw === 'number' && Number.isFinite(sw);
          const hasH = typeof sh === 'number' && Number.isFinite(sh);
          if (!hasW && !hasH) continue;
          const act: BookLayoutAiSetSlideDimensionsAction = {
            type: 'set_slide_dimensions',
          };
          if (hasW) {
            act.slideWidth = Math.min(4000, Math.max(100, Math.round(sw)));
          }
          if (hasH) {
            act.slideHeight = Math.min(4000, Math.max(100, Math.round(sh)));
          }
          actions.push(act);
          continue;
        }

        if (t === 'replace_widget_media') {
          if (!selection) continue;
          const elementId =
            typeof a.elementId === 'string'
              ? a.elementId.trim().slice(0, 80)
              : '';
          if (!elementId || elementId !== selection.elementId) continue;
          const widget = a.widget;
          if (widget !== 'image' && widget !== 'video') continue;
          if (widget !== selection.kind) continue;

          const act: BookLayoutAiReplaceWidgetMediaAction = {
            type: 'replace_widget_media',
            elementId,
            widget,
          };
          if (
            typeof a.imageSearchQuery === 'string' &&
            a.imageSearchQuery.trim()
          ) {
            act.imageSearchQuery = a.imageSearchQuery.trim().slice(0, 200);
          }
          if (typeof a.imageUrl === 'string' && a.imageUrl.trim()) {
            const u = a.imageUrl.trim().slice(0, 2000);
            if (/^https:\/\//i.test(u)) act.imageUrl = u;
          }
          if (
            typeof a.videoSearchQuery === 'string' &&
            a.videoSearchQuery.trim()
          ) {
            act.videoSearchQuery = a.videoSearchQuery.trim().slice(0, 200);
          }
          if (typeof a.videoUrl === 'string' && a.videoUrl.trim()) {
            const u = a.videoUrl.trim().slice(0, 2000);
            if (/^https:\/\//i.test(u)) act.videoUrl = u;
          }
          actions.push(act);
          continue;
        }

        if (t !== 'add_widget') continue;
        const widget = a.widget;
        const anchorRaw = a.anchor;
        if (typeof widget !== 'string' || !WIDGETS.has(widget)) continue;

        const hasExplicitBox =
          typeof a.x === 'number' &&
          Number.isFinite(a.x) &&
          typeof a.y === 'number' &&
          Number.isFinite(a.y) &&
          typeof a.width === 'number' &&
          Number.isFinite(a.width) &&
          typeof a.height === 'number' &&
          Number.isFinite(a.height);

        if (
          !hasExplicitBox &&
          (typeof anchorRaw !== 'string' || !ANCHORS.has(anchorRaw))
        ) {
          continue;
        }

        const anchor =
          typeof anchorRaw === 'string' && ANCHORS.has(anchorRaw)
            ? anchorRaw
            : 'topLeft';

        const act: BookLayoutAiAddWidgetAction = {
          type: 'add_widget',
          widget: widget as BookLayoutAiAddWidgetAction['widget'],
          anchor,
        };

        if (hasExplicitBox) {
          const r = this.clampAiWidgetRect(
            a.x as number,
            a.y as number,
            a.width as number,
            a.height as number,
            slideW,
            slideH,
          );
          act.x = r.x;
          act.y = r.y;
          act.width = r.width;
          act.height = r.height;
        }
        if (
          typeof a.slideNumber === 'number' &&
          Number.isFinite(a.slideNumber)
        ) {
          const sn = Math.round(a.slideNumber);
          if (sn >= 1 && sn <= 500) act.slideNumber = sn;
        }
        if (typeof a.cityQuery === 'string' && a.cityQuery.trim()) {
          act.cityQuery = a.cityQuery.trim().slice(0, 120);
        }
        if (typeof a.text === 'string' && a.text.trim()) {
          act.text = a.text.trim().slice(0, 4000);
        }
        if (typeof a.fontSize === 'number' && Number.isFinite(a.fontSize)) {
          const fs = Math.round(a.fontSize);
          if (fs >= 10 && fs <= 120) act.fontSize = fs;
        }
        if (
          typeof a.imageSearchQuery === 'string' &&
          a.imageSearchQuery.trim()
        ) {
          act.imageSearchQuery = a.imageSearchQuery.trim().slice(0, 200);
        }
        if (typeof a.imageUrl === 'string' && a.imageUrl.trim()) {
          const u = a.imageUrl.trim().slice(0, 2000);
          if (/^https:\/\//i.test(u)) act.imageUrl = u;
        }
        if (
          typeof a.videoSearchQuery === 'string' &&
          a.videoSearchQuery.trim()
        ) {
          act.videoSearchQuery = a.videoSearchQuery.trim().slice(0, 200);
        }
        if (typeof a.videoUrl === 'string' && a.videoUrl.trim()) {
          const u = a.videoUrl.trim().slice(0, 2000);
          if (/^https:\/\//i.test(u)) act.videoUrl = u;
        }
        actions.push(act);
      }
    }
    return { reply, actions };
  }

  private async enrichActions(
    result: BookLayoutAiResult,
  ): Promise<BookLayoutAiResult> {
    const notes: string[] = [];
    const out: BookLayoutAiAction[] = [];

    for (const act of result.actions) {
      if (act.type === 'replace_widget_media') {
        if (act.widget === 'image') {
          let src = act.imageUrl?.trim();
          if (src && !/^https:\/\//i.test(src)) {
            src = undefined;
          }

          if (!src && act.imageSearchQuery?.trim()) {
            const hit = await this.pexels.searchFirstPhoto(
              act.imageSearchQuery,
            );
            if (hit) {
              out.push({
                ...act,
                src: hit.url,
                imageWidth: hit.width,
                imageHeight: hit.height,
              });
            } else {
              const hasKey = Boolean(
                process.env.PEXELS_API_KEY?.trim(),
              );
              notes.push(
                hasKey
                  ? `이미지 검색에 결과가 없습니다: "${act.imageSearchQuery}"`
                  : '이미지 검색을 쓰려면 서버에 PEXELS_API_KEY를 설정하세요.',
              );
            }
            continue;
          }

          if (src) {
            out.push({ ...act, src });
            continue;
          }

          notes.push(
            '선택 이미지 교체에 검색어(imageSearchQuery) 또는 https URL(imageUrl)이 필요합니다.',
          );
          continue;
        }

        if (act.widget === 'video') {
          let src = act.videoUrl?.trim();
          if (src && !/^https:\/\//i.test(src)) {
            src = undefined;
          }

          const qPrev = act.videoSearchQuery?.trim()
            ? act.videoSearchQuery.trim().length > 64
              ? `${act.videoSearchQuery.trim().slice(0, 64)}…`
              : act.videoSearchQuery.trim()
            : '—';
          console.log(
            `[layout-ai] replace video enrich videoSearchQuery="${qPrev}" videoUrl=${Boolean(src)} elementId=${act.elementId}`,
          );

          if (!src && act.videoSearchQuery?.trim()) {
            const t0 = Date.now();
            const hit = await this.pexels.searchFirstVideo(
              act.videoSearchQuery,
            );
            const ms = Date.now() - t0;
            if (hit) {
              let host = '';
              try {
                host = new URL(hit.videoUrl).hostname;
              } catch {
                host = '?';
              }
              console.log(
                `[layout-ai] replace video Pexels OK ${ms}ms srcHost=${host}`,
              );
              out.push({
                ...act,
                src: hit.videoUrl,
                posterSrc: hit.posterUrl,
                videoWidth: hit.width,
                videoHeight: hit.height,
              });
            } else {
              const hasKey = Boolean(
                process.env.PEXELS_API_KEY?.trim(),
              );
              console.warn(
                `[layout-ai] replace video Pexels MISS ${ms}ms hasApiKey=${hasKey} query="${act.videoSearchQuery?.trim().slice(0, 80)}"`,
              );
              notes.push(
                hasKey
                  ? `동영상 검색에 결과가 없습니다: "${act.videoSearchQuery}"`
                  : '동영상 검색을 쓰려면 서버에 PEXELS_API_KEY를 설정하세요.',
              );
            }
            continue;
          }

          if (src) {
            let host = '';
            try {
              host = new URL(src).hostname;
            } catch {
              host = '?';
            }
            console.log(`[layout-ai] replace video 직접 URL host=${host}`);
            out.push({
              ...act,
              src,
              posterSrc:
                act.posterSrc != null && String(act.posterSrc).trim()
                  ? String(act.posterSrc).trim()
                  : null,
            });
            continue;
          }

          notes.push(
            '선택 동영상 교체에 검색어(videoSearchQuery) 또는 https URL(videoUrl)이 필요합니다.',
          );
          continue;
        }

        notes.push('replace_widget_media: image 또는 video만 지원합니다.');
        continue;
      }

      if (act.type !== 'add_widget') {
        out.push(act);
        continue;
      }

      if (act.widget === 'image') {
        let src = act.imageUrl?.trim();
        if (src && !/^https:\/\//i.test(src)) {
          src = undefined;
        }

        if (!src && act.imageSearchQuery?.trim()) {
          const hit = await this.pexels.searchFirstPhoto(act.imageSearchQuery);
          if (hit) {
            out.push({
              ...act,
              src: hit.url,
              imageWidth: hit.width,
              imageHeight: hit.height,
            });
          } else {
            const hasKey = Boolean(
              process.env.PEXELS_API_KEY?.trim(),
            );
            notes.push(
              hasKey
                ? `이미지 검색에 결과가 없습니다: "${act.imageSearchQuery}"`
                : '이미지 검색을 쓰려면 서버에 PEXELS_API_KEY를 설정하세요.',
            );
          }
          continue;
        }

        if (src) {
          out.push({ ...act, src });
          continue;
        }

        notes.push(
          '이미지 위젯에 검색어(imageSearchQuery) 또는 https URL(imageUrl)이 필요합니다.',
        );
        continue;
      }

      if (act.widget === 'video') {
        let src = act.videoUrl?.trim();
        if (src && !/^https:\/\//i.test(src)) {
          src = undefined;
        }

        const qPrev = act.videoSearchQuery?.trim()
          ? act.videoSearchQuery.trim().length > 64
            ? `${act.videoSearchQuery.trim().slice(0, 64)}…`
            : act.videoSearchQuery.trim()
          : '—';
        console.log(
          `[layout-ai] video enrich 입력 videoSearchQuery="${qPrev}" videoUrl=${Boolean(src)} slideNumber=${act.slideNumber ?? 'omit'}`,
        );

        if (!src && act.videoSearchQuery?.trim()) {
          const t0 = Date.now();
          const hit = await this.pexels.searchFirstVideo(act.videoSearchQuery);
          const ms = Date.now() - t0;
          if (hit) {
            let host = '';
            try {
              host = new URL(hit.videoUrl).hostname;
            } catch {
              host = '?';
            }
            console.log(
              `[layout-ai] video Pexels enrich OK ${ms}ms srcHost=${host} (클라이언트 재생 시 CDN 추가 요청·버퍼링은 네트워크 탭으로 확인)`,
            );
            out.push({
              ...act,
              src: hit.videoUrl,
              posterSrc: hit.posterUrl,
              videoWidth: hit.width,
              videoHeight: hit.height,
            });
          } else {
            const hasKey = Boolean(
              process.env.PEXELS_API_KEY?.trim(),
            );
            console.warn(
              `[layout-ai] video Pexels enrich MISS ${ms}ms hasApiKey=${hasKey} query="${act.videoSearchQuery?.trim().slice(0, 80)}"`,
            );
            notes.push(
              hasKey
                ? `동영상 검색에 결과가 없습니다: "${act.videoSearchQuery}"`
                : '동영상 검색을 쓰려면 서버에 PEXELS_API_KEY를 설정하세요.',
            );
          }
          continue;
        }

        if (src) {
          let host = '';
          try {
            host = new URL(src).hostname;
          } catch {
            host = '?';
          }
          console.log(`[layout-ai] video 직접 URL 사용 host=${host}`);
          out.push({
            ...act,
            src,
            posterSrc:
              act.posterSrc != null && String(act.posterSrc).trim()
                ? String(act.posterSrc).trim()
                : null,
          });
          continue;
        }

        console.warn(
          '[layout-ai] video enrich 불가: videoSearchQuery·videoUrl 둘 다 없음',
        );
        notes.push(
          '동영상 위젯에 검색어(videoSearchQuery) 또는 https URL(videoUrl)이 필요합니다.',
        );
        continue;
      }

      out.push(act);
    }

    let reply = result.reply;
    if (notes.length > 0) {
      reply = `${reply}\n\n※ ${notes.join(' ')}`.slice(0, 2500);
    }

    return { reply, actions: out };
  }

  /**
   * 성공 응답 한 턴(user + assistant)만 저장. 북 작성자가 아니면 조용히 return.
   * OpenAI 요청 본문에는 넣지 않으므로 토큰 사용량은 변하지 않습니다.
   */
  async tryPersistChatTurn(
    bookId: number,
    actor: AuthActor,
    userMessage: string,
    assistantReply: string,
  ): Promise<void> {
    try {
      await this.booksService.assertBookOwner(bookId, actor);
    } catch {
      return;
    }
    const u = userMessage.trim().slice(0, 4000);
    const a = assistantReply.trim().slice(0, 12000);
    if (!u || !a) return;
    await this.db().insert(bookAiChatMessage).values([
      { bookId, role: "user", body: u },
      { bookId, role: "assistant", body: a },
    ]);
  }

  async listLayoutChat(
    bookId: number,
    actor: AuthActor,
  ): Promise<
    {
      id: number;
      role: 'user' | 'assistant';
      text: string;
      createdAt: string;
    }[]
  > {
    await this.booksService.assertBookOwner(bookId, actor);
    const rows = await this.db()
      .select()
      .from(bookAiChatMessage)
      .where(eq(bookAiChatMessage.bookId, bookId))
      .orderBy(asc(bookAiChatMessage.createdAt))
      .limit(BookAiService.CHAT_PAGE);
    return rows.map((r) => ({
      id: r.id,
      role: r.role as "user" | "assistant",
      text: r.body,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
