// 글 본문: TipTap 툴바·정렬·코드; HTML 저장
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#000000",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#2563eb",
  "#9333ea",
  "#db2777",
] as const;

/** 클릭 시 커서 위치에 삽입 (이모지·기호) */
const QUICK_INSERT_CHIPS: { char: string; tip: string }[] = [
  { char: "⭐", tip: "별 · 중요 표시 삽입" },
  { char: "❤️", tip: "하트 삽입" },
  { char: "👍", tip: "좋아요 삽입" },
  { char: "✅", tip: "체크(완료) 삽입" },
  { char: "❌", tip: "엑스 삽입" },
  { char: "📌", tip: "핀 · 고정 표시 삽입" },
  { char: "🔥", tip: "불 · 인기 표시 삽입" },
  { char: "💡", tip: "전구 · 아이디어 삽입" },
  { char: "📝", tip: "메모 표시 삽입" },
  { char: "⚠️", tip: "주의 삽입" },
  { char: "✨", tip: "반짝임 삽입" },
  { char: "🎉", tip: "축하 삽입" },
  { char: "💬", tip: "말풍선 삽입" },
  { char: "➡️", tip: "오른쪽 화살표 삽입" },
  { char: "▶", tip: "재생/다음 표시 삽입" },
  { char: "✓", tip: "체크 표(단순) 삽입" },
  { char: "→", tip: "화살표(텍스트) 삽입" },
  { char: "…", tip: "말줄임표 삽입" },
];

/** 선택한 글자만 적용되는 글자 크기(px) */
const FONT_SIZE_PRESETS: { value: string; label: string; tip: string }[] = [
  { value: "12px", label: "12", tip: "글자 크기 작게 (12px)" },
  { value: "14px", label: "14", tip: "글자 크기 조금 작게 (14px)" },
  { value: "16px", label: "16", tip: "글자 크기 보통 (16px)" },
  { value: "20px", label: "20", tip: "글자 크게 (20px)" },
  { value: "28px", label: "28", tip: "글자 아주 크게 (28px)" },
];

type Props = {
  initialHtml: string;
  invalid?: boolean;
  onHtmlChange?: (html: string) => void;
};

function TipToolbarBtn({
  tip,
  ariaLabel,
  active,
  onClick,
  children,
  disabled,
}: {
  tip: string;
  ariaLabel: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2"
          disabled={disabled}
          onClick={onClick}
          aria-label={ariaLabel}
          aria-pressed={active}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[16rem] text-pretty">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function TipInsertChip({
  char,
  tip,
  onInsert,
}: {
  char: string;
  tip: string;
  onInsert: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-lg leading-none transition hover:bg-muted/80 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          onClick={onInsert}
          aria-label={`${tip} — ${char}`}
        >
          <span className="select-none" aria-hidden>
            {char}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[14rem] text-pretty">
        {tip} (커서 위치에 넣기)
      </TooltipContent>
    </Tooltip>
  );
}

function TipColorSwatch({ hex, onPick }: { hex: string; onPick: () => void }) {
  const tip = `글자 색 ${hex} 적용 (선택한 텍스트만)`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="size-6 shrink-0 rounded border border-border shadow-sm ring-offset-background transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          style={{ backgroundColor: hex }}
          onClick={onPick}
          aria-label={tip}
        />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[14rem] text-pretty">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

export function PostRichEditor({ initialHtml, invalid, onHtmlChange }: Props) {
  const [html, setHtml] = useState(() => initialHtml?.trim() || "<p></p>");
  const colorInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          link: {
            openOnClick: false,
            HTMLAttributes: {
              rel: "noopener noreferrer",
              target: "_blank",
            },
          },
        }),
        TextStyle,
        Color,
        FontSize,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Placeholder.configure({
          placeholder:
            "본문을 입력하세요. 굵게, 목록, 링크, 인용 등을 사용할 수 있습니다.",
        }),
      ],
      content: initialHtml?.trim() ? initialHtml : "<p></p>",
      editorProps: {
        attributes: {
          class: cn(
            "min-h-[12rem] max-w-none rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "[&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:italic",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
            "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[0.85em]",
            "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:ps-5",
            "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:ps-5",
            "[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold",
            "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-semibold",
            "[&_p]:my-1",
            "[&_hr]:my-3 [&_hr]:border-border",
            invalid && "border-destructive",
            !invalid && "border-input",
          ),
        },
      },
      onUpdate: ({ editor: ed }) => {
        const h = ed.getHTML();
        setHtml(h);
        onHtmlChange?.(h);
      },
    },
    [initialHtml],
  );

  const ts = editor?.getAttributes("textStyle") ?? {};
  const currentFontSize = (ts.fontSize as string | undefined) ?? null;
  const currentColor = (ts.color as string | undefined) ?? null;

  return (
    <TooltipProvider delayDuration={400}>
      <div className="space-y-2">
        <input type="hidden" name="content" value={html} readOnly aria-hidden />

        <div className="rounded-md border border-border bg-muted/30 p-1">
          {editor ? (
            <>
              <div className="flex flex-wrap gap-0.5">
                <TipToolbarBtn
                  tip="선택한 글자를 굵게 표시합니다. (단락 전체 제목과는 다릅니다)"
                  ariaLabel="굵게"
                  active={editor.isActive("bold")}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="선택한 글자를 기울임꼴로 표시합니다."
                  ariaLabel="기울임"
                  active={editor.isActive("italic")}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="선택한 글자에 밑줄을 긋습니다."
                  ariaLabel="밑줄"
                  active={editor.isActive("underline")}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <UnderlineIcon className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="선택한 글자에 취소선을 긋습니다."
                  ariaLabel="취소선"
                  active={editor.isActive("strike")}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough className="size-4" />
                </TipToolbarBtn>

                <span
                  className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:inline-block"
                  aria-hidden
                />

                <div className="flex flex-wrap items-center gap-0.5">
                  <span className="sr-only">글자 크기</span>
                  {FONT_SIZE_PRESETS.map(({ value, label, tip }) => (
                    <TipToolbarBtn
                      key={value}
                      tip={tip}
                      ariaLabel={tip}
                      active={currentFontSize === value}
                      onClick={() =>
                        editor.chain().focus().setFontSize(value).run()
                      }
                    >
                      <span className="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums">
                        {label}
                      </span>
                    </TipToolbarBtn>
                  ))}
                  <TipToolbarBtn
                    tip="선택한 글에 지정한 글자 크기를 없애고, 단락 기본 크기로 돌립니다."
                    ariaLabel="글자 크기 초기화"
                    active={false}
                    disabled={!currentFontSize}
                    onClick={() => editor.chain().focus().unsetFontSize().run()}
                  >
                    <RemoveFormatting className="size-4" />
                  </TipToolbarBtn>
                </div>

                <span
                  className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:inline-block"
                  aria-hidden
                />

                <div className="flex flex-wrap items-center gap-0.5">
                  <span className="sr-only">글자 색</span>
                  {PRESET_COLORS.map((c) => (
                    <TipColorSwatch
                      key={c}
                      hex={c}
                      onPick={() => editor.chain().focus().setColor(c).run()}
                    />
                  ))}
                  <input
                    ref={colorInputRef}
                    type="color"
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                    defaultValue="#000000"
                    onChange={(e) =>
                      editor.chain().focus().setColor(e.target.value).run()
                    }
                  />
                  <TipToolbarBtn
                    tip="시스템 색상 창에서 원하는 글자 색을 고릅니다. 먼저 문장에서 글자를 선택하세요."
                    ariaLabel="색상 직접 선택"
                    active={Boolean(currentColor)}
                    onClick={() => colorInputRef.current?.click()}
                  >
                    <Palette className="size-4" />
                  </TipToolbarBtn>
                  <TipToolbarBtn
                    tip="선택한 글에서만 글자 색을 제거합니다."
                    ariaLabel="글자 색 제거"
                    active={false}
                    disabled={!currentColor}
                    onClick={() => editor.chain().focus().unsetColor().run()}
                  >
                    <span className="text-xs font-semibold text-muted-foreground">
                      A
                    </span>
                  </TipToolbarBtn>
                </div>

                <span
                  className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:inline-block"
                  aria-hidden
                />

                <TipToolbarBtn
                  tip="선택한 부분을 인라인 코드 스타일(짧은 코드 조각)로 표시합니다."
                  ariaLabel="인라인 코드"
                  active={editor.isActive("code")}
                  onClick={() => editor.chain().focus().toggleCode().run()}
                >
                  <Code className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="현재 줄/단락을 ‘중간 제목’ 크기(제목 2) 블록으로 바꿉니다. 글자만 키우는 것이 아니라 단락 전체가 제목이 됩니다."
                  ariaLabel="제목 2"
                  active={editor.isActive("heading", { level: 2 })}
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                >
                  <Heading2 className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="현재 줄/단락을 ‘작은 제목’(제목 3) 블록으로 바꿉니다."
                  ariaLabel="제목 3"
                  active={editor.isActive("heading", { level: 3 })}
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                  }
                >
                  <Heading3 className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="글머리 기호 목록을 만듭니다."
                  ariaLabel="글머리 목록"
                  active={editor.isActive("bulletList")}
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                >
                  <List className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="번호가 매겨진 목록을 만듭니다."
                  ariaLabel="번호 목록"
                  active={editor.isActive("orderedList")}
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                >
                  <ListOrdered className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="인용문 블록(왼쪽 막대)으로 표시합니다."
                  ariaLabel="인용"
                  active={editor.isActive("blockquote")}
                  onClick={() =>
                    editor.chain().focus().toggleBlockquote().run()
                  }
                >
                  <Quote className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="가로 구분선을 한 줄 넣습니다."
                  ariaLabel="구분선"
                  active={false}
                  onClick={() =>
                    editor.chain().focus().setHorizontalRule().run()
                  }
                >
                  <Minus className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="현재 단락/제목의 텍스트를 왼쪽 정렬합니다."
                  ariaLabel="왼쪽 정렬"
                  active={editor.isActive({ textAlign: "left" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("left").run()
                  }
                >
                  <AlignLeft className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="가운데 정렬합니다."
                  ariaLabel="가운데 정렬"
                  active={editor.isActive({ textAlign: "center" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("center").run()
                  }
                >
                  <AlignCenter className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="오른쪽 정렬합니다."
                  ariaLabel="오른쪽 정렬"
                  active={editor.isActive({ textAlign: "right" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("right").run()
                  }
                >
                  <AlignRight className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="양쪽 맞춤(줄 끝을 맞춤)합니다."
                  ariaLabel="양쪽 정렬"
                  active={editor.isActive({ textAlign: "justify" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("justify").run()
                  }
                >
                  <AlignJustify className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="선택한 글자에 링크(URL)를 겁니다. 주소를 비우면 링크만 제거합니다."
                  ariaLabel="링크"
                  active={editor.isActive("link")}
                  onClick={() => {
                    const prev = editor.getAttributes("link").href as
                      | string
                      | undefined;
                    const url = window.prompt(
                      "링크 URL (비우면 제거)",
                      prev ?? "https://",
                    );
                    if (url === null) return;
                    const t = url.trim();
                    if (t === "") {
                      editor
                        .chain()
                        .focus()
                        .extendMarkRange("link")
                        .unsetLink()
                        .run();
                      return;
                    }
                    editor
                      .chain()
                      .focus()
                      .extendMarkRange("link")
                      .setLink({ href: t })
                      .run();
                  }}
                >
                  <Link2 className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="방금 한 작업을 취소합니다."
                  ariaLabel="실행 취소"
                  active={false}
                  disabled={!editor.can().undo()}
                  onClick={() => editor.chain().focus().undo().run()}
                >
                  <Undo2 className="size-4" />
                </TipToolbarBtn>
                <TipToolbarBtn
                  tip="실행 취소했던 작업을 다시 적용합니다."
                  ariaLabel="다시 실행"
                  active={false}
                  disabled={!editor.can().redo()}
                  onClick={() => editor.chain().focus().redo().run()}
                >
                  <Redo2 className="size-4" />
                </TipToolbarBtn>
              </div>

              <div
                role="group"
                aria-label="즐겨 쓰는 기호 삽입"
                className="mt-1 flex flex-wrap items-center gap-0.5 border-t border-border pt-1"
              >
                <span className="sr-only">즐겨 쓰는 기호</span>
                {QUICK_INSERT_CHIPS.map(({ char, tip }) => (
                  <TipInsertChip
                    key={char + tip}
                    char={char}
                    tip={tip}
                    onInsert={() =>
                      editor.chain().focus().insertContent(char).run()
                    }
                  />
                ))}
              </div>
            </>
          ) : (
            <span className="px-2 py-1 text-xs text-muted-foreground">
              에디터 로드 중…
            </span>
          )}
        </div>

        <EditorContent editor={editor} />
      </div>
    </TooltipProvider>
  );
}
