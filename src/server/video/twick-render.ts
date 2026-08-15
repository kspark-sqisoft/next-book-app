// 서버측 Twick 렌더 — 헤드리스 Chromium(Playwright)으로 앱 내부 /internal/render 페이지를
// secure context(127.0.0.1)에서 열어 WebCodecs 렌더를 실행하고 MP4 바이트를 회수한다.
//
// WebCodecs(VideoEncoder/Decoder)는 secure context에서만 노출되므로, 렌더 페이지는 반드시
// 앱 자신(localhost/127.0.0.1)에서 서빙되어야 한다. 그래서 브라우저는 자기 서버로 되돌아 접속한다.
import { type Browser, chromium } from "playwright";

export type TwickRenderInput = {
  properties?: { width?: number; height?: number; fps?: number };
  tracks: unknown[];
  backgroundColor?: string;
};

export type TwickRenderSettings = {
  width: number;
  height: number;
  fps: number;
  includeAudio?: boolean;
};

/** 렌더 1건 상한 — 헤드리스가 특정 프레임에서 멈춰도 프로세스를 무한 점유하지 않도록 */
const RENDER_TIMEOUT_MS = 15 * 60 * 1000;

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    // Docker에서는 openh264 포함 Debian 시스템 chromium(/usr/bin/chromium)을 써야 H.264 WebCodecs
    // 인코딩이 된다. Playwright 번들 chromium은 openh264가 없어 H.264 인코드가 "closed codec"으로 실패한다.
    // 로컬(호스트)에서는 이 env가 없으므로 Playwright 번들 chromium(Mac 등, H.264 지원)을 그대로 사용.
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || undefined;
    browserPromise = chromium
      .launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: [
          "--use-gl=swiftshader",
          "--autoplay-policy=no-user-gesture-required",
          // Docker(root) 환경 대비 — 로컬에선 무해
          "--no-sandbox",
          "--disable-dev-shm-usage",
        ],
      })
      .catch((e) => {
        browserPromise = null; // 실패 시 다음 호출에서 재시도 가능
        throw e;
      });
  }
  return browserPromise;
}

function selfOrigin(): string {
  const port = process.env.PORT || "3000";
  // localhost 도 secure context(WebCodecs 사용 가능)이며, 업로드 영상 URL이 http://localhost:PORT/uploads/...
  // 로 저장되므로 렌더 페이지도 localhost 오리진이어야 same-origin으로 그 영상을 가져올 수 있다
  // (127.0.0.1 이면 cross-origin → CORS 없는 /uploads 로드 실패).
  return `http://localhost:${port}`;
}

export async function renderTwickProjectToMp4(
  input: TwickRenderInput,
  settings: TwickRenderSettings,
  onProgress?: (p: number) => void,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (onProgress) {
      await page.exposeFunction("__twickReportProgress", (p: number) => {
        onProgress(Math.max(0, Math.min(1, Number(p) || 0)));
      });
    }
    await page.goto(`${selfOrigin()}/internal/render`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForFunction(() => window.__twickRenderReady === true, null, {
      timeout: 60_000,
    });
    if (onProgress) {
      await page.evaluate(() => {
        window.__twickOnProgress = (p: number) =>
          (
            window as unknown as { __twickReportProgress: (p: number) => void }
          ).__twickReportProgress(p);
      });
    }

    const base64 = await Promise.race([
      page.evaluate(
        async ({ input, settings }) =>
          window.__twickRenderToBase64!(input, settings),
        { input, settings },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("렌더 시간 초과(15분)")),
          RENDER_TIMEOUT_MS,
        ),
      ),
    ]);

    return Buffer.from(base64, "base64");
  } finally {
    await page.close().catch(() => {
      /* 페이지 정리 실패는 무시 */
    });
  }
}

/**
 * 렌더된 MP4에서 첫 프레임을 JPEG poster로 뽑는다(미디어 라이브러리 썸네일용).
 * MP4를 페이지 안에서 blob URL로 만들어 로드하므로 same-origin → canvas 오염 없이 toDataURL 가능.
 * 실패(코덱/디코드 등) 시 null — poster 없이 저장은 진행된다.
 */
export async function capturePosterFromMp4(
  mp4: Buffer,
): Promise<Buffer | null> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(`${selfOrigin()}/internal/render`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const dataB64 = await page.evaluate(async (mp4b64: string) => {
      const bin = atob(mp4b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
      try {
        const v = document.createElement("video");
        v.muted = true;
        v.preload = "metadata";
        v.src = url;
        await new Promise<void>((res, rej) => {
          v.onloadedmetadata = () => res();
          v.onerror = () => rej(new Error("metadata"));
        });
        const t =
          Number.isFinite(v.duration) && v.duration > 0
            ? Math.min(0.1, v.duration * 0.1)
            : 0;
        await new Promise<void>((res, rej) => {
          v.onseeked = () => res();
          v.onerror = () => rej(new Error("seek"));
          v.currentTime = t;
        });
        const w = v.videoWidth || 1280;
        const h = v.videoHeight || 720;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(v, 0, 0, w, h);
        return canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? null;
      } finally {
        URL.revokeObjectURL(url);
      }
    }, mp4.toString("base64"));
    return dataB64 ? Buffer.from(dataB64, "base64") : null;
  } catch {
    return null;
  } finally {
    await page.close().catch(() => {
      /* 무시 */
    });
  }
}
