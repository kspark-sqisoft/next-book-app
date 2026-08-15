"use client";

// 서버측(헤드리스 Chromium) 전용 렌더 페이지.
// Playwright가 이 페이지를 secure context(localhost)로 열고 window.__twickRenderToBase64 를 호출한다.
// WebCodecs는 secure context에서만 노출되므로 반드시 앱(localhost/https)에서 서빙되어야 한다.
import { renderTwickVideoInBrowser } from "@twick/browser-render";
import { useEffect } from "react";

type RenderInput = {
  properties?: { width?: number; height?: number; fps?: number };
  tracks: unknown[];
  backgroundColor?: string;
};

type RenderSettings = {
  width: number;
  height: number;
  fps: number;
  includeAudio?: boolean;
  /** 출력 화질 배율(browser-render resolutionScale): low=1×, medium=1.5×, high=2× */
  quality?: "low" | "medium" | "high";
};

declare global {
  interface Window {
    /** Playwright가 호출 — 렌더 후 MP4를 base64로 반환 */
    __twickRenderToBase64?: (
      input: RenderInput,
      settings: RenderSettings,
    ) => Promise<string>;
    /** 진행률 콜백 — Playwright의 exposeFunction으로 주입될 수 있음(선택) */
    __twickOnProgress?: (p: number) => void;
    /** 렌더 준비 완료 신호 */
    __twickRenderReady?: boolean;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function InternalRenderPage() {
  useEffect(() => {
    window.__twickRenderToBase64 = async (input, settings) => {
      const blob = await renderTwickVideoInBrowser({
        variables: { input },
        settings: {
          width: settings.width,
          height: settings.height,
          fps: settings.fps,
          quality: settings.quality ?? "medium",
          includeAudio: settings.includeAudio ?? true,
          onProgress: (p: number) => {
            try {
              window.__twickOnProgress?.(p);
            } catch {
              /* 진행률 콜백 실패는 렌더에 영향 없음 */
            }
          },
        },
      });
      const buf = new Uint8Array(await blob.arrayBuffer());
      return bytesToBase64(buf);
    };
    window.__twickRenderReady = true;
    return () => {
      delete window.__twickRenderToBase64;
      window.__twickRenderReady = false;
    };
  }, []);

  // 헤드리스 전용 페이지 — 사람이 볼 UI는 없다(Playwright만 접속).
  return (
    <div style={{ padding: 16, fontFamily: "monospace" }}>
      twick render worker
    </div>
  );
}
