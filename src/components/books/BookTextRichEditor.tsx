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
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Bold,
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
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { BOOK_HEX_COLOR_PRESETS } from "@/lib/book-color-presets";
import { richHtmlToPlainText, sanitizeBookRichHtml } from "@/lib/book-text-widget";
import { cn } from "@/lib/utils";

/** 위젯 기본 글자 크기(`fontSize`) 대비. `em`이라 슬라이드 배율과 맞습니다. */
const BOOK_RICH_FONT_SIZE_PRESETS: { value: string; label: string; title: string }[] = [
  { value: "0.7em", label: "70%", title: "선택 영역 글자 크기 70%" },
  { value: "0.85em", label: "85%", title: "선택 영역 글자 크기 85%" },
  { value: "1.25em", label: "125%", title: "선택 영역 글자 크기 125%" },
  { value: "1.5em", label: "150%", title: "선택 영역 글자 크기 150%" },
  { value: "2em", label: "200%", title: "선택 영역 글자 크기 200%" },
];

type Props = {
  /** 선택이 바뀔 때마다 바꿔 에디터를 초기화합니다. */
  widgetKey: string;
  /** 초기·외부(undo 등) 동기화용 HTML */
  html: string;
  placeholder?: string;
  onRichPatch: (patch: { richHtml: string; text: string }) => void;
  /** 위젯 박스가 글보다 클 때 블록 세로 위치 — 좌우 맞춤과 같은 툴바 */
  verticalAlign?: "top" | "middle" | "bottom";
  onVerticalAlignChange?: (v: "top" | "middle" | "bottom") => void;
};

export function BookTextRichEditor({
  widgetKey,
  html,
  placeholder = "내용을 입력하세요…",
  onRichPatch,
  verticalAlign = "top",
  onVerticalAlignChange,
}: Props) {
  const lastEmitted = useRef("");
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    lastEmitted.current = "";
  }, [widgetKey]);

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
        TextAlign.configure({
          types: ["heading", "paragraph", "blockquote", "listItem"],
        }),
        TextStyle,
        Color,
        FontSize,
        Placeholder.configure({ placeholder }),
      ],
      content: html?.trim() ? html : "<p></p>",
      editorProps: {
        attributes: {
          class: cn(
            "min-h-[10rem] max-w-none rounded-md border border-input bg-background px-2.5 py-2 text-sm leading-relaxed shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "[&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-2 [&_blockquote]:italic",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
            "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[0.85em]",
            "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:ps-4",
            "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:ps-4",
            "[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold",
            "[&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_h3]:text-sm [&_h3]:font-semibold",
            "[&_p]:my-1",
            "[&_hr]:my-2 [&_hr]:border-border",
            "[&_a]:text-primary [&_a]:underline",
          ),
        },
      },
      onUpdate: ({ editor: ed }) => {
        const richHtml = sanitizeBookRichHtml(ed.getHTML());
        const text = richHtmlToPlainText(richHtml);
        lastEmitted.current = richHtml;
        onRichPatch({ richHtml, text });
      },
    },
    [widgetKey],
  );

  const ts = editor?.getAttributes("textStyle") ?? {};
  const currentTextColor = (ts.color as string | undefined) ?? null;
  const currentFontSize = (ts.fontSize as string | undefined) ?? null;

  useEffect(() => {
    if (!editor) return;
    const clean = sanitizeBookRichHtml(html || "<p></p>");
    if (clean === lastEmitted.current) return;
    editor.commands.setContent(html?.trim() ? html : "<p></p>", { emitUpdate: false });
    lastEmitted.current = clean;
  }, [html, editor, widgetKey]);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", prev ?? "https://");
    if (url === null) return;
    const t = url.trim();
    if (t === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: t }).run();
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-0.5 rounded-md border border-border bg-muted/25 p-0.5">
        {editor ? (
          <>
            <Btn
              title="굵게"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="size-3.5" />
            </Btn>
            <Btn
              title="기울임"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="size-3.5" />
            </Btn>
            <Btn
              title="취소선"
              active={editor.isActive("strike")}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="size-3.5" />
            </Btn>
            <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden />
            <span className="sr-only">글자 색</span>
            {BOOK_HEX_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={`선택 영역 색: ${c}`}
                aria-label={`선택한 글자 색 ${c}`}
                className="size-5 shrink-0 rounded border border-border shadow-sm ring-offset-background hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                style={{ backgroundColor: c }}
                onClick={() => editor.chain().focus().setColor(c).run()}
              />
            ))}
            <input
              ref={colorInputRef}
              type="color"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              defaultValue="#111827"
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
            <Btn
              title="색 직접 선택 (먼저 글자를 선택하세요)"
              active={Boolean(currentTextColor)}
              onClick={() => colorInputRef.current?.click()}
            >
              <Palette className="size-3.5" />
            </Btn>
            <Btn
              title="선택 영역 글자 색 제거"
              active={false}
              disabled={!currentTextColor}
              onClick={() => editor.chain().focus().unsetColor().run()}
            >
              <span className="text-[10px] font-semibold text-muted-foreground">A</span>
            </Btn>
            <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden />
            <span className="sr-only">선택 영역 글자 크기</span>
            <Btn
              title="위젯 기본 글자 크기로(선택 부분만)"
              active={!currentFontSize}
              onClick={() => editor.chain().focus().unsetFontSize().run()}
            >
              <span className="text-[10px] font-semibold tabular-nums">기본</span>
            </Btn>
            {BOOK_RICH_FONT_SIZE_PRESETS.map(({ value, label, title }) => (
              <Btn
                key={value}
                title={title}
                active={currentFontSize === value}
                onClick={() => editor.chain().focus().setFontSize(value).run()}
              >
                <span className="min-w-[1.6rem] text-center text-[10px] font-semibold tabular-nums">
                  {label}
                </span>
              </Btn>
            ))}
            <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden />
            <Btn
              title="소제목 2"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="size-3.5" />
            </Btn>
            <Btn
              title="소제목 3"
              active={editor.isActive("heading", { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 className="size-3.5" />
            </Btn>
            <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden />
            <span className="sr-only">문단 정렬</span>
            <Btn
              title="왼쪽 맞춤"
              active={
                editor.isActive({ textAlign: "left" }) ||
                (!editor.isActive({ textAlign: "center" }) &&
                  !editor.isActive({ textAlign: "right" }) &&
                  !editor.isActive({ textAlign: "justify" }))
              }
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
            >
              <AlignLeft className="size-3.5" />
            </Btn>
            <Btn
              title="가운데 맞춤"
              active={editor.isActive({ textAlign: "center" })}
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
            >
              <AlignCenter className="size-3.5" />
            </Btn>
            <Btn
              title="오른쪽 맞춤"
              active={editor.isActive({ textAlign: "right" })}
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
            >
              <AlignRight className="size-3.5" />
            </Btn>
            <Btn
              title="양쪽 맞춤"
              active={editor.isActive({ textAlign: "justify" })}
              onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            >
              <AlignJustify className="size-3.5" />
            </Btn>
            {onVerticalAlignChange ? (
              <>
                <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden />
                <span className="sr-only">위젯 박스 안 세로 맞춤</span>
                <Btn
                  title="위젯 박스 안 세로: 위쪽 (글 블록을 박스 위에 붙임)"
                  active={verticalAlign === "top"}
                  onClick={() => onVerticalAlignChange("top")}
                >
                  <AlignVerticalJustifyStart className="size-3.5" />
                </Btn>
                <Btn
                  title="위젯 박스 안 세로: 가운데"
                  active={verticalAlign === "middle"}
                  onClick={() => onVerticalAlignChange("middle")}
                >
                  <AlignVerticalJustifyCenter className="size-3.5" />
                </Btn>
                <Btn
                  title="위젯 박스 안 세로: 아래쪽"
                  active={verticalAlign === "bottom"}
                  onClick={() => onVerticalAlignChange("bottom")}
                >
                  <AlignVerticalJustifyEnd className="size-3.5" />
                </Btn>
              </>
            ) : null}
            <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden />
            <Btn
              title="글머리 목록"
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="size-3.5" />
            </Btn>
            <Btn
              title="번호 목록"
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="size-3.5" />
            </Btn>
            <Btn
              title="인용"
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="size-3.5" />
            </Btn>
            <Btn title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
              <Minus className="size-3.5" />
            </Btn>
            <Btn title="링크" active={editor.isActive("link")} onClick={setLink}>
              <Link2 className="size-3.5" />
            </Btn>
            <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden />
            <Btn title="실행 취소" onClick={() => editor.chain().focus().undo().run()}>
              <Undo2 className="size-3.5" />
            </Btn>
            <Btn title="다시 실행" onClick={() => editor.chain().focus().redo().run()}>
              <Redo2 className="size-3.5" />
            </Btn>
          </>
        ) : null}
      </div>
      {editor ? <EditorContent editor={editor} /> : null}
    </div>
  );
}

function Btn({
  children,
  title,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className="h-7 px-1.5"
      title={title}
      aria-label={title}
      aria-pressed={active ?? false}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
