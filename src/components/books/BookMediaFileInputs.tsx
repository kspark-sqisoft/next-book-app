"use client";

import type { useBookMediaUploads } from "@/features/book/use-book-media-uploads";

/**
 * 화면에 보이지 않는 파일 선택 입력 넷 — 이미지·동영상·플레이리스트 항목·PDF.
 *
 * 우클릭 메뉴나 팔레트가 이 입력들을 프로그램적으로 클릭해서 파일 선택창을 연다.
 * 어느 입력이 열렸는지는 `useBookMediaUploads` 의 ref 들이 기억한다 — 그래서 `onChange`
 * 는 "지금 기다리던 종류가 맞는지" 먼저 확인하고, 아니면 그냥 흘려보낸다.
 *
 * `e.target.value = ""` 는 매번 필요하다. 같은 파일을 다시 고르면 값이 바뀌지 않아
 * `change` 가 오지 않기 때문이다(교체를 취소했다가 같은 파일로 다시 하는 흐름).
 */
export function BookMediaFileInputs({
  inputs,
}: {
  inputs: ReturnType<typeof useBookMediaUploads>["fileInputs"];
}) {
  const {
    imageRef,
    videoRef,
    playlistRef,
    pdfRef,
    pendingMediaKindRef,
    replaceMediaElementIdRef,
    playlistAppendElementIdRef,
    handleMediaFile,
    handlePlaylistMediaFile,
    handleImportPdfFile,
  } = inputs;

  return (
    <>
      <input
        ref={imageRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (pendingMediaKindRef.current !== "image") return;
          if (!f) {
            replaceMediaElementIdRef.current = null;
            pendingMediaKindRef.current = null;
            return;
          }
          void handleMediaFile(f, "image");
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (pendingMediaKindRef.current !== "video") return;
          if (!f) {
            replaceMediaElementIdRef.current = null;
            pendingMediaKindRef.current = null;
            return;
          }
          void handleMediaFile(f, "video");
        }}
      />
      <input
        ref={playlistRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) {
            playlistAppendElementIdRef.current = null;
            return;
          }
          void handlePlaylistMediaFile(f);
        }}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          void handleImportPdfFile(f);
        }}
      />
    </>
  );
}
