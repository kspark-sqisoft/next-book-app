"use client";

import type { Draft } from "immer";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { BookReplaceMediaFromFileRequest } from "@/components/books/BookSlideCanvas";
import {
  type BookCanvasElement,
  type BookEditorPageState,
  MEDIA_PLAYLIST_MAX_ITEMS,
} from "@/features/book/book-canvas";
import { renderPdfFileToPageImages } from "@/features/book/book-pdf-import";
import { setSelectedIds } from "@/features/book/editor-ui-store";
import { uploadBookMedia } from "@/lib/api";

type UpdatePages = (
  recipe: (draft: Draft<BookEditorPageState>[]) => void,
) => void;

/** 라이브러리에서 고르는 중인 대상 — 교체할 요소이거나, 항목을 덧붙일 플레이리스트 */
export type BookLibraryPick =
  | { mode: "replace"; elementId: string; kind: "image" | "video" }
  | { mode: "playlistAppend"; elementId: string };

/**
 * 북에 파일을 올려 슬라이드에 넣는 모든 경로.
 *
 * 이미지·동영상 업로드, 플레이리스트 항목 추가, PDF 페이지 변환, 라이브러리에서 고르기가
 * `BookDetailOwnerView` 안에 300줄 넘게 섞여 있었다. 숨은 `<input type="file">` 네 개와
 * 그 사이를 잇는 ref 다섯 개가 화면 곳곳에 흩어져, 어느 클릭이 어느 입력으로 가는지
 * 따라가기 어려웠다. 그 배선을 통째로 여기로 옮긴다.
 *
 * 새 북 화면에는 이 훅이 없다 — 저장 전에는 업로드할 북 id 가 없기 때문이다.
 */
export function useBookMediaUploads(opts: {
  bookId: number;
  activePageIndex: number;
  activePage: BookEditorPageState | undefined;
  slideWidth: number;
  slideHeight: number;
  updatePages: UpdatePages;
  appendToMediaLibrary: (m: {
    kind: "image" | "video";
    src: string;
    posterUrl: string | null;
  }) => void;
  /** 라이브러리 패널을 떠 있는 창 맨 위로 — 고르기 창이 뒤에 가리지 않게 */
  raiseFloatingMediaStack: () => void;
}) {
  const {
    bookId,
    activePageIndex,
    activePage,
    slideWidth,
    slideHeight,
    updatePages,
    appendToMediaLibrary,
    raiseFloatingMediaStack,
  } = opts;

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const playlistMediaInputRef = useRef<HTMLInputElement>(null);
  const playlistAppendElementIdRef = useRef<string | null>(null);
  const pendingMediaKindRef = useRef<"image" | "video" | null>(null);
  const pendingPlacementRef = useRef<{ x: number; y: number } | null>(null);
  const replaceMediaElementIdRef = useRef<string | null>(null);
  const [libraryPick, setLibraryPick] = useState<
    | { mode: "replace"; elementId: string; kind: "image" | "video" }
    | { mode: "playlistAppend"; elementId: string }
    | null
  >(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pdfImportBusy, setPdfImportBusy] = useState(false);
  const pdfImportInputRef = useRef<HTMLInputElement>(null);
  /** 드래그 드롭으로 시작한 경우 위젯을 놓을 지점(더블 클릭·버튼은 null → 중앙) */
  const pdfImportPlacementRef = useRef<{ x: number; y: number } | null>(null);

  const libraryPickAcceptKind =
    libraryPick == null
      ? null
      : libraryPick.mode === "replace"
        ? libraryPick.kind
        : ("both" as const);

  useEffect(() => {
    if (!libraryPick || !activePage) return;
    const el = activePage.elements.find((e) => e.id === libraryPick.elementId);
    if (!el) {
      setLibraryPick(null);
      return;
    }
    if (libraryPick.mode === "replace" && el.type !== libraryPick.kind) {
      setLibraryPick(null);
      return;
    }
    if (libraryPick.mode === "playlistAppend" && el.type !== "mediaPlaylist") {
      setLibraryPick(null);
    }
  }, [libraryPick, activePage]);

  const handleMediaFile = async (file: File, kind: "image" | "video") => {
    setUploadError(null);
    const replaceElementId = replaceMediaElementIdRef.current;
    replaceMediaElementIdRef.current = null;
    const pos = pendingPlacementRef.current ?? { x: 100, y: 100 };
    const idx = activePageIndex;
    pendingPlacementRef.current = null;
    pendingMediaKindRef.current = null;
    try {
      const res = await uploadBookMedia(bookId, file, null);
      if (kind === "image" && res.kind !== "image") {
        throw new Error("이미지 파일이 아닙니다.");
      }
      if (kind === "video" && res.kind !== "video") {
        throw new Error("동영상 파일이 아닙니다.");
      }
      if (replaceElementId) {
        updatePages((draft) => {
          const p = draft[idx];
          if (!p) return;
          const el = p.elements.find((e) => e.id === replaceElementId);
          if (!el) return;
          if (el.type === "image" && res.kind === "image") {
            Object.assign(el, { src: res.url });
          } else if (el.type === "video" && res.kind === "video") {
            Object.assign(el, {
              src: res.url,
              posterSrc: res.posterUrl ?? null,
            });
          }
        });
        appendToMediaLibrary({
          kind: res.kind,
          src: res.url,
          posterUrl: res.posterUrl,
        });
        toast.success("미디어를 바꿨습니다.");
        return;
      }
      const id = crypto.randomUUID();
      const w = kind === "image" ? 400 : 480;
      const h = kind === "image" ? 260 : 270;
      const el: BookCanvasElement =
        res.kind === "image"
          ? {
              id,
              type: "image",
              x: pos.x,
              y: pos.y,
              width: w,
              height: h,
              src: res.url,
            }
          : {
              id,
              type: "video",
              x: pos.x,
              y: pos.y,
              width: w,
              height: h,
              src: res.url,
              posterSrc: res.posterUrl,
            };
      updatePages((draft) => {
        const p = draft[idx];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
      appendToMediaLibrary({
        kind: res.kind,
        src: res.url,
        posterUrl: res.posterUrl,
      });
      toast.success(
        kind === "image" ? "이미지를 넣었습니다." : "동영상을 넣었습니다.",
      );
    } catch (e) {
      setUploadError((e as Error).message);
    }
  };

  const onRequestReplaceMediaFromFile = useCallback(
    (req: BookReplaceMediaFromFileRequest) => {
      replaceMediaElementIdRef.current = req.elementId;
      pendingMediaKindRef.current = req.kind;
      if (req.kind === "image") {
        imageInputRef.current?.click();
      } else {
        videoInputRef.current?.click();
      }
    },
    [],
  );

  const onRequestPickLibraryMediaForReplace = useCallback(
    (req: { elementId: string }) => {
      const el = activePage?.elements.find((e) => e.id === req.elementId);
      if (!el || (el.type !== "image" && el.type !== "video")) return;
      setLibraryPick({
        mode: "replace",
        elementId: req.elementId,
        kind: el.type,
      });
      raiseFloatingMediaStack();
    },
    [activePage, raiseFloatingMediaStack],
  );

  const handlePlaylistMediaFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      const elementId = playlistAppendElementIdRef.current;
      playlistAppendElementIdRef.current = null;
      if (!elementId) return;
      const idx = activePageIndex;
      try {
        const res = await uploadBookMedia(bookId, file, null);
        let blockedFull = false;
        let applied = false;
        updatePages((draft) => {
          const p = draft[idx];
          if (!p) return;
          const el = p.elements.find((e) => e.id === elementId);
          if (!el || el.type !== "mediaPlaylist") return;
          const cur = el.mediaPlaylistItems ?? [];
          if (cur.length >= MEDIA_PLAYLIST_MAX_ITEMS) {
            blockedFull = true;
            return;
          }
          if (res.kind === "image") {
            el.mediaPlaylistItems = [
              ...cur,
              { id: crypto.randomUUID(), kind: "image", src: res.url },
            ];
          } else {
            el.mediaPlaylistItems = [
              ...cur,
              {
                id: crypto.randomUUID(),
                kind: "video",
                src: res.url,
                posterSrc: res.posterUrl ?? null,
              },
            ];
          }
          applied = true;
        });
        if (blockedFull) {
          toast.error(
            `미디어 목록은 최대 ${MEDIA_PLAYLIST_MAX_ITEMS}개입니다.`,
          );
          return;
        }
        if (!applied) return;
        appendToMediaLibrary({
          kind: res.kind,
          src: res.url,
          posterUrl: res.posterUrl,
        });
        toast.success("목록 끝에 미디어를 추가했습니다.");
      } catch (e) {
        setUploadError((e as Error).message);
      }
    },
    [activePageIndex, appendToMediaLibrary, bookId, updatePages],
  );

  /** PDF 가져오기 — 각 페이지를 PNG로 변환·업로드해 미디어 재생목록 위젯으로 추가 */
  const handleImportPdfFile = useCallback(
    async (file: File) => {
      const idx = activePageIndex;
      setPdfImportBusy(true);
      const toastId = toast.loading("PDF 페이지 변환 중…");
      try {
        const { pages, totalPageCount } = await renderPdfFileToPageImages(
          file,
          {
            maxPages: MEDIA_PLAYLIST_MAX_ITEMS,
            onProgress: (done, total) =>
              toast.loading(`PDF 페이지 변환 중… (${done}/${total})`, {
                id: toastId,
              }),
          },
        );
        if (pages.length === 0) {
          throw new Error("PDF에서 페이지를 찾지 못했습니다.");
        }
        const baseName = file.name.replace(/\.pdf$/i, "").trim() || "pdf";
        const items: { id: string; kind: "image"; src: string }[] = [];
        for (let i = 0; i < pages.length; i++) {
          toast.loading(`페이지 업로드 중… (${i + 1}/${pages.length})`, {
            id: toastId,
          });
          const pageFile = new File(
            [pages[i]!.blob],
            `${baseName}-p${i + 1}.png`,
            { type: "image/png" },
          );
          const res = await uploadBookMedia(bookId, pageFile, null);
          items.push({ id: crypto.randomUUID(), kind: "image", src: res.url });
        }
        // 위젯 프레임: 첫 페이지 비율로 슬라이드의 ~70%, 중앙 배치
        const first = pages[0]!;
        const aspect = first.height / Math.max(1, first.width);
        let w = Math.max(80, Math.min(slideWidth * 0.7, slideWidth - 40));
        let h = w * aspect;
        const maxH = Math.max(80, slideHeight - 40);
        if (h > maxH) {
          h = maxH;
          w = h / Math.max(0.01, aspect);
        }
        w = Math.round(w);
        h = Math.round(h);
        const at = pdfImportPlacementRef.current;
        pdfImportPlacementRef.current = null;
        const px = at
          ? Math.round(Math.min(Math.max(0, at.x), Math.max(0, slideWidth - w)))
          : Math.round((slideWidth - w) / 2);
        const py = at
          ? Math.round(
              Math.min(Math.max(0, at.y), Math.max(0, slideHeight - h)),
            )
          : Math.round((slideHeight - h) / 2);
        const el: BookCanvasElement = {
          id: crypto.randomUUID(),
          type: "mediaPlaylist",
          x: px,
          y: py,
          width: w,
          height: h,
          mediaPlaylistItems: items,
        };
        updatePages((draft) => {
          const p = draft[idx];
          if (!p) return;
          p.elements.push(el);
        });
        setSelectedIds([el.id]);
        toast.success(
          `PDF ${pages.length}페이지를 미디어 위젯으로 추가했습니다. 페이지별 표시 시간은 속성 패널에서 바꿀 수 있어요.`,
          { id: toastId },
        );
        if (totalPageCount > pages.length) {
          toast.warning(
            `PDF가 ${totalPageCount}페이지라 앞 ${pages.length}페이지만 가져왔습니다(위젯 항목 최대 ${MEDIA_PLAYLIST_MAX_ITEMS}개).`,
          );
        }
      } catch (e) {
        toast.error(`PDF 가져오기 실패: ${(e as Error).message}`, {
          id: toastId,
        });
      } finally {
        setPdfImportBusy(false);
      }
    },
    [activePageIndex, bookId, slideHeight, slideWidth, updatePages],
  );

  /**
   * PDF 가져오기 시작. `at` 은 드롭 지점(팔레트 더블 클릭·버튼은 null → 슬라이드 중앙).
   * 이전에는 호출부마다 `pdfImportPlacementRef` 를 직접 건드리고 진행 중 검사를 따로
   * 했다 — 세 곳에 흩어져 있어 한 곳만 고치기 쉬웠다.
   */
  const requestImportPdf = useCallback(
    (at: { x: number; y: number } | null) => {
      if (pdfImportBusy) return;
      pdfImportPlacementRef.current = at;
      pdfImportInputRef.current?.click();
    },
    [pdfImportBusy],
  );

  const onRequestPlaylistAppendFromFile = useCallback(
    (elementId: string) => {
      const el = activePage?.elements.find((e) => e.id === elementId);
      if (!el || el.type !== "mediaPlaylist") return;
      if ((el.mediaPlaylistItems ?? []).length >= MEDIA_PLAYLIST_MAX_ITEMS) {
        toast.error(`미디어 목록은 최대 ${MEDIA_PLAYLIST_MAX_ITEMS}개입니다.`);
        return;
      }
      playlistAppendElementIdRef.current = elementId;
      playlistMediaInputRef.current?.click();
    },
    [activePage],
  );

  const onRequestPlaylistAppendFromLibrary = useCallback(
    (elementId: string) => {
      setLibraryPick({ mode: "playlistAppend", elementId });
      raiseFloatingMediaStack();
    },
    [raiseFloatingMediaStack],
  );

  useEffect(() => {
    const onImgVidCancel = () => {
      replaceMediaElementIdRef.current = null;
      pendingMediaKindRef.current = null;
    };
    const onPlaylistCancel = () => {
      playlistAppendElementIdRef.current = null;
    };
    const img = imageInputRef.current;
    const vid = videoInputRef.current;
    const pl = playlistMediaInputRef.current;
    img?.addEventListener("cancel", onImgVidCancel);
    vid?.addEventListener("cancel", onImgVidCancel);
    pl?.addEventListener("cancel", onPlaylistCancel);
    return () => {
      img?.removeEventListener("cancel", onImgVidCancel);
      vid?.removeEventListener("cancel", onImgVidCancel);
      pl?.removeEventListener("cancel", onPlaylistCancel);
    };
  }, []);

  return {
    uploadError,
    pdfImportBusy,
    libraryPick,
    setLibraryPick,
    libraryPickAcceptKind,
    onRequestReplaceMediaFromFile,
    onRequestPickLibraryMediaForReplace,
    onRequestPlaylistAppendFromFile,
    onRequestPlaylistAppendFromLibrary,
    requestImportPdf,
    fileInputs: {
      imageRef: imageInputRef,
      videoRef: videoInputRef,
      playlistRef: playlistMediaInputRef,
      pdfRef: pdfImportInputRef,
      pendingMediaKindRef,
      replaceMediaElementIdRef,
      playlistAppendElementIdRef,
      handleMediaFile,
      handlePlaylistMediaFile,
      handleImportPdfFile,
    },
  };
}
