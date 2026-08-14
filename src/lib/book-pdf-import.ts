// PDF 가져오기 — 브라우저에서 pdfjs로 각 페이지를 PNG로 렌더링(서버 변환 없음)
// 결과 이미지는 기존 업로드 경로로 올려 미디어 재생목록 위젯 항목으로 쓴다.

export type BookPdfImportedPage = {
  blob: Blob;
  /** 렌더링된 픽셀 크기 — 위젯 프레임 비율 계산용 */
  width: number;
  height: number;
};

export type BookPdfImportResult = {
  pages: BookPdfImportedPage[];
  /** 원본 PDF 전체 페이지 수(maxPages로 잘린 경우 pages.length보다 큼) */
  totalPageCount: number;
};

/** 페이지 렌더링 가로 픽셀 — 1280 슬라이드에서 확대해도 선명하도록 여유 있게 */
const RENDER_TARGET_WIDTH_PX = 1600;

export async function renderPdfFileToPageImages(
  file: File,
  opts: {
    maxPages: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<BookPdfImportResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const totalPageCount = doc.numPages;
    const count = Math.min(totalPageCount, Math.max(1, opts.maxPages));
    const pages: BookPdfImportedPage[] = [];
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = RENDER_TARGET_WIDTH_PX / Math.max(1, base.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("캔버스 컨텍스트를 만들 수 없습니다.");
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("페이지 이미지 인코딩 실패")),
          "image/png",
        );
      });
      pages.push({ blob, width: canvas.width, height: canvas.height });
      opts.onProgress?.(i, count);
      page.cleanup();
    }
    return { pages, totalPageCount };
  } finally {
    await loadingTask.destroy();
  }
}
