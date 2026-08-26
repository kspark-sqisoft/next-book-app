// 동영상 첫 프레임 → JPEG 포스터(썸네일). 업로드할 때 만들어 함께 올린다.
//
// 주의: `seeked` 가 떴다고 그릴 준비가 된 게 아니다. seek 는 **위치**가 정해지면 발생하고,
// 그 위치의 프레임이 디코드됐는지는 별개다(`readyState >= HAVE_CURRENT_DATA`).
// preload="metadata" 로 두면 프레임 데이터를 받아오지 않아 `drawImage` 가 검은 화면을
// 그리는 일이 잦았다 — 파일 크기·코덱·캐시에 따라 되기도 하고 안 되기도 하는 경합이었다.
// 그래서 데이터를 실제로 받고(preload="auto"), 프레임이 화면에 올라온 것을 확인한 뒤 그린다.

/** 프레임이 실제로 그릴 수 있는 상태가 될 때까지 기다린다 */
async function waitForDrawableFrame(
  video: HTMLVideoElement,
  timeoutMs: number,
): Promise<void> {
  if (video.readyState >= 2 /* HAVE_CURRENT_DATA */) return;
  await new Promise<void>((resolve, reject) => {
    const to = window.setTimeout(() => {
      cleanup();
      reject(new Error("frame-timeout"));
    }, timeoutMs);
    const done = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      window.clearTimeout(to);
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("canplay", done);
    };
    video.addEventListener("loadeddata", done);
    video.addEventListener("canplay", done);
  });
}

/** 한 프레임이 화면에 올라올 때까지 — 지원하면 정확하고, 아니면 rAF 한 번으로 대신 */
async function nextPresentedFrame(video: HTMLVideoElement): Promise<void> {
  const rvfc = (
    video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    }
  ).requestVideoFrameCallback;
  if (typeof rvfc === "function") {
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      rvfc.call(video, finish);
      // 일시정지 상태에선 콜백이 안 올 수 있어 짧은 상한을 둔다
      window.setTimeout(finish, 400);
    });
    return;
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/** 그려진 캔버스가 사실상 단색(검정)인지 — 성긴 표본으로 확인 */
function looksBlank(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { data } = ctx.getImageData(0, 0, w, h);
  const step = Math.max(4, Math.floor((data.length / 4 / 400) * 4));
  let max = 0;
  for (let i = 0; i < data.length; i += step) {
    max = Math.max(max, data[i], data[i + 1], data[i + 2]);
    if (max > 12) return false;
  }
  return true;
}

export async function captureVideoPosterJpeg(
  file: File,
  opts?: { maxWidth?: number; quality?: number },
): Promise<File | null> {
  const maxW = opts?.maxWidth ?? 640;
  const quality = opts?.quality ?? 0.85;
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    // 프레임 데이터까지 받아야 그릴 수 있다 — metadata 만으로는 검은 화면이 나온다
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      const to = window.setTimeout(() => reject(new Error("metadata")), 15_000);
      video.onloadedmetadata = () => {
        window.clearTimeout(to);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(to);
        reject(new Error("metadata"));
      };
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    const scale = Math.min(1, maxW / w);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    /** 첫 시도는 앞쪽, 실패(검은 프레임)하면 조금 뒤로 — 페이드인으로 시작하는 영상 대비 */
    const seekPoints =
      dur > 0 ? [Math.min(1, dur * 0.1), Math.min(3, dur * 0.5)] : [0];

    for (const t of seekPoints) {
      try {
        await new Promise<void>((resolve, reject) => {
          const to = window.setTimeout(() => reject(new Error("seek")), 10_000);
          video.onseeked = () => {
            window.clearTimeout(to);
            resolve();
          };
          video.onerror = () => {
            window.clearTimeout(to);
            reject(new Error("seek"));
          };
          video.currentTime = t;
        });
        // seek 완료 ≠ 그릴 준비 완료 — 프레임이 올라올 때까지 기다린다
        await waitForDrawableFrame(video, 10_000);
        await nextPresentedFrame(video);
        ctx.drawImage(video, 0, 0, cw, ch);
        if (!looksBlank(ctx, cw, ch)) break;
      } catch {
        // 이 지점은 실패 — 다음 지점으로
      }
    }

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", quality),
    );
    if (!blob) return null;
    return new File([blob], "video-poster.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
