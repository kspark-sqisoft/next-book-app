/**
 * 로컬 비디오 파일에서 첫 구간 프레임을 잘라 JPEG 파일로 만듭니다.
 * 코덱/브라우저 제한으로 실패하면 `null`을 반환합니다.
 */
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
    video.preload = "metadata";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("metadata"));
    });

    const dur = video.duration;
    const t = Number.isFinite(dur) && dur > 0 ? Math.min(0.25, dur * 0.1) : 0;
    video.currentTime = t;

    await new Promise<void>((resolve, reject) => {
      const to = window.setTimeout(() => reject(new Error("timeout")), 10_000);
      video.onseeked = () => {
        clearTimeout(to);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(to);
        reject(new Error("seek"));
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, cw, ch);

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
