// 업로드된 비디오 여러 개를 ffmpeg으로 이어붙여 하나의 MP4를 만든다.
// 입력들의 해상도·코덱·오디오 유무가 제각각일 수 있어, 각 입력을 공통 규격
// (첫 입력 해상도, 30fps, H.264+AAC, 무음 오디오 보충)으로 재인코딩한 뒤
// concat demuxer(-c copy)로 무손실 결합한다. Twick 렌더를 거치지 않으므로
// 타임라인 뒤쪽 비디오가 검게 나오는 렌더 파이프라인 버그와 무관하게 동작한다.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, normalize, resolve } from "node:path";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

import { UPLOAD_ROOT } from "@/server/env";

/** 입력 1개당 재인코딩 상한 — 비정상 입력이 프로세스를 점유하지 않게 */
const STEP_TIMEOUT_MS = 10 * 60 * 1000;

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

/**
 * "/uploads/..." 상대 경로 또는 오리진이 붙은 절대 URL에서 업로드 파일의
 * 실제 경로를 구한다. 업로드 루트 밖(경로 탈출)이나 비디오가 아니면 거부.
 */
async function resolveUploadedVideoPath(url: string): Promise<string> {
  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      throw new Error(`잘못된 URL입니다: ${url.slice(0, 80)}`);
    }
  }
  if (!pathname.startsWith("/uploads/")) {
    throw new Error("업로드된 파일(/uploads/…)만 이어붙일 수 있습니다.");
  }
  const rel = decodeURIComponent(pathname.slice("/uploads/".length));
  if (!VIDEO_EXT.test(rel)) {
    throw new Error("비디오 파일(mp4·webm·mov)만 이어붙일 수 있습니다.");
  }
  const base = resolve(UPLOAD_ROOT);
  const full = resolve(normalize(join(base, rel)));
  if (!full.startsWith(base)) {
    throw new Error("허용되지 않는 경로입니다.");
  }
  const info = await stat(full).catch(() => null);
  if (!info?.isFile()) {
    throw new Error(`파일을 찾을 수 없습니다: ${rel}`);
  }
  return full;
}

type ProbeInfo = {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
};

function parseTimecode(tc: string): number {
  const m = /(\d+):(\d{2}):(\d{2})\.(\d{2})/.exec(tc);
  if (!m) return 0;
  return (
    Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 100
  );
}

/** ffmpeg 실행 — stderr를 모으고, onStderr로 진행 파싱 콜백을 지원 */
function runFfmpeg(
  args: string[],
  opts?: { allowNonZeroExit?: boolean; onStderr?: (chunk: string) => void },
): Promise<{ stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(ffmpegInstaller.path, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg 실행 시간 초과"));
    }, STEP_TIMEOUT_MS);
    child.stderr.on("data", (d: Buffer) => {
      const text = d.toString();
      // 진행 파싱용으로 최근 로그만 유지(장시간 인코딩의 메모리 증가 방지)
      stderr = (stderr + text).slice(-8000);
      opts?.onStderr?.(text);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 || opts?.allowNonZeroExit) resolvePromise({ stderr });
      else
        reject(
          new Error(`ffmpeg 실패(code ${code}): ${stderr.slice(-400).trim()}`),
        );
    });
  });
}

/** `ffmpeg -i`의 stderr에서 길이·해상도·오디오 유무를 읽는다(ffprobe 없이). */
async function probeVideo(path: string): Promise<ProbeInfo> {
  const { stderr } = await runFfmpeg(["-hide_banner", "-i", path], {
    allowNonZeroExit: true, // 출력 없이 -i만 주면 ffmpeg은 코드 1로 끝난다
  });
  const dur = /Duration:\s*(\d+:\d{2}:\d{2}\.\d{2})/.exec(stderr);
  const dims = /Video:.*?\s(\d{2,5})x(\d{2,5})/.exec(stderr);
  if (!dur || !dims) {
    throw new Error("비디오 정보를 읽지 못했습니다(손상됐거나 미지원 형식).");
  }
  return {
    durationSec: parseTimecode(dur[1]),
    width: Number(dims[1]),
    height: Number(dims[2]),
    hasAudio: /Stream #.*Audio:/.test(stderr),
  };
}

/**
 * 업로드된 비디오 URL 목록을 순서대로 이어붙인 MP4 버퍼를 돌려준다.
 * onProgress는 0..1 (재인코딩 구간 0~0.95, 결합·읽기 0.95~1).
 */
export async function concatUploadedVideosToMp4(
  urls: string[],
  onProgress?: (p: number) => void,
): Promise<Buffer> {
  if (!Array.isArray(urls) || urls.length < 2) {
    throw new Error("이어붙일 비디오를 2개 이상 선택하세요.");
  }
  const inputs = await Promise.all(urls.map(resolveUploadedVideoPath));
  const probes = await Promise.all(inputs.map(probeVideo));

  // 출력 규격 = 첫 비디오 해상도(libx264 제약으로 짝수 보정), 30fps
  const outW = Math.max(2, Math.floor(probes[0].width / 2) * 2);
  const outH = Math.max(2, Math.floor(probes[0].height / 2) * 2);
  const totalDur = probes.reduce((acc, p) => acc + p.durationSec, 0) || 1;

  const workDir = await mkdtemp(join(tmpdir(), "book-video-concat-"));
  try {
    const parts: string[] = [];
    let doneDur = 0;
    for (let i = 0; i < inputs.length; i++) {
      const out = join(workDir, `part-${i}.mp4`);
      const vf = `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
      const args = probes[i].hasAudio
        ? ["-hide_banner", "-i", inputs[i], "-map", "0:v:0", "-map", "0:a:0"]
        : [
            "-hide_banner",
            "-i",
            inputs[i],
            // 오디오 없는 입력엔 무음을 깔아 모든 조각의 스트림 구성을 맞춘다
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-shortest",
          ];
      args.push(
        "-vf",
        vf,
        "-r",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        "-y",
        out,
      );
      const baseDone = doneDur;
      await runFfmpeg(args, {
        onStderr: (chunk) => {
          const m = /time=(\d+:\d{2}:\d{2}\.\d{2})/.exec(chunk);
          if (!m || !onProgress) return;
          const cur = Math.min(parseTimecode(m[1]), probes[i].durationSec);
          onProgress(Math.min(0.95, ((baseDone + cur) / totalDur) * 0.95));
        },
      });
      doneDur += probes[i].durationSec;
      onProgress?.(Math.min(0.95, (doneDur / totalDur) * 0.95));
      parts.push(out);
    }

    // 같은 규격으로 재인코딩된 조각들 → concat demuxer로 무손실 결합
    const listPath = join(workDir, "list.txt");
    await writeFile(
      listPath,
      parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
      "utf8",
    );
    const outPath = join(workDir, "output.mp4");
    await runFfmpeg([
      "-hide_banner",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "-y",
      outPath,
    ]);
    onProgress?.(0.98);
    return await readFile(outPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {
      /* 임시 폴더 정리 실패는 무시 */
    });
  }
}
