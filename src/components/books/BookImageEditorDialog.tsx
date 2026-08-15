"use client";

// 이미지 편집 — Filerobot 편집기를 전체 화면으로 띄우고, 저장 시 파일을 만들어 호출측(업로드·라이브러리)에 넘긴다
import { ImagePlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FilerobotImageEditor, {
  TABS,
  TOOLS,
} from "react-filerobot-image-editor";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  onClose: () => void;
  /** 내보내기 결과 파일 — 업로드·미디어 라이브러리 등록은 호출측 책임 */
  onExport: (file: File) => Promise<void>;
};

/** Filerobot 내부 UI를 앱 디자인 토큰(shadcn)과 저장 버튼 파랑(blue-600)에 맞춤 */
const FILEROBOT_THEME = {
  palette: {
    "bg-primary": "var(--card)",
    "bg-primary-light": "var(--muted)",
    "bg-primary-hover": "var(--muted)",
    "bg-primary-active": "var(--accent)",
    "bg-primary-stateless": "var(--card)",
    "bg-secondary": "var(--background)",
    "bg-stateless": "var(--card)",
    "bg-hover": "var(--muted)",
    "bg-active": "var(--accent)",
    "bg-base-light": "var(--background)",
    "bg-base-medium": "var(--muted)",
    "bg-grey": "var(--muted)",
    "txt-primary": "var(--foreground)",
    "txt-secondary": "var(--muted-foreground)",
    "txt-placeholder": "var(--muted-foreground)",
    "icon-primary": "var(--foreground)",
    "accent-primary": "#2563eb",
    "accent-primary-hover": "#1d4ed8",
    "accent-primary-active": "#1e40af",
    "accent-stateless": "#2563eb",
    link: "#2563eb",
  },
  typography: { fontFamily: "var(--font-sans)" },
};

/** Filerobot onSave 결과에서 쓰는 필드만(버전 간 차이를 흡수) */
type FilerobotSavedImage = {
  imageCanvas?: HTMLCanvasElement;
  imageBase64?: string;
  fullName?: string;
  name?: string;
  mimeType?: string;
  extension?: string;
};

async function savedImageToFile(saved: FilerobotSavedImage): Promise<File> {
  const mime = saved.mimeType || "image/png";
  const ext = saved.extension || (mime === "image/jpeg" ? "jpg" : "png");
  const name =
    saved.fullName || `${saved.name?.trim() || "edited-image"}.${ext}`;
  if (saved.imageCanvas) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      saved.imageCanvas!.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("이미지 인코딩 실패"))),
        mime,
        0.92,
      );
    });
    return new File([blob], name, { type: blob.type || mime });
  }
  if (saved.imageBase64) {
    const blob = await (await fetch(saved.imageBase64)).blob();
    return new File([blob], name, { type: blob.type || mime });
  }
  throw new Error("편집 결과 이미지를 읽지 못했습니다.");
}

export function BookImageEditorDialog({ onClose, onExport }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("edited-image");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  const pickFile = useCallback((file: File) => {
    setSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setSourceName(file.name.replace(/\.[^.]+$/, "") || "edited-image");
  }, []);

  const handleSave = useCallback(
    (saved: unknown) => {
      void (async () => {
        setSaving(true);
        // 1) 편집 결과 → File 변환. 실패를 조용히 삼키면 "저장 눌러도 아무 일 없음"으로 보이므로 노출한다.
        let file: File;
        try {
          file = await savedImageToFile(saved as FilerobotSavedImage);
        } catch (e) {
          console.error("[이미지 편집] 결과 이미지 변환 실패:", e, saved);
          toast.error(
            `이미지 저장 실패: ${e instanceof Error ? e.message : String(e)}`,
          );
          setSaving(false);
          return;
        }
        // 2) 업로드·라이브러리 등록은 호출측(onExport). 실패 토스트도 그쪽에서 띄우고 여기선 편집 화면 유지.
        try {
          await onExport(file);
          onClose();
        } catch {
          setSaving(false);
        }
      })();
    },
    [onClose, onExport],
  );

  /* 워크스페이스 패널·채팅(z≤3500)보다 위에 오도록 body 포털로 렌더 —
     내부에 두면 조상 스태킹 컨텍스트에 갇혀 기존 패널이 편집기를 가린다 */
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[5000] flex flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-3">
        <h2 className="font-heading text-sm font-semibold">이미지 편집</h2>
        <div className="flex items-center gap-1.5">
          {src ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-xs"
              disabled={saving}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="mr-1.5 size-3.5" aria-hidden />
              다른 이미지 열기
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            disabled={saving}
            onClick={onClose}
          >
            <X className="mr-1.5 size-3.5" aria-hidden />
            나가기
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {src ? (
          <FilerobotImageEditor
            source={src}
            defaultSavedImageName={sourceName}
            onSave={handleSave}
            onClose={onClose}
            savingPixelRatio={1}
            previewPixelRatio={
              typeof window !== "undefined" ? window.devicePixelRatio : 1
            }
            tabsIds={[
              TABS.ADJUST,
              TABS.FINETUNE,
              TABS.FILTERS,
              TABS.ANNOTATE,
              TABS.RESIZE,
            ]}
            defaultTabId={TABS.ADJUST}
            defaultToolId={TOOLS.CROP}
            theme={FILEROBOT_THEME as never}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              로컬 이미지를 열어 자르기·색 보정·필터·텍스트를 적용하고
              <br />
              저장하면 미디어 라이브러리에 추가됩니다.
            </p>
            <Button type="button" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="size-4" aria-hidden />
              이미지 열기
            </Button>
          </div>
        )}

        {saving ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
              <Spinner className="size-4" />
              <span className="text-sm">저장 중…</span>
            </div>
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) pickFile(f);
        }}
      />
    </div>,
    document.body,
  );
}
