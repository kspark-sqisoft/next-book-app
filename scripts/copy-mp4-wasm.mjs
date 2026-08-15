#!/usr/bin/env node
/**
 * `@twick/browser-render`가 MP4 muxing에 쓰는 `mp4-wasm.wasm`을 `public/`에 self-host한다.
 *
 * 이유: browser-render는 로드 경로를 `/mp4-wasm.wasm` → `/assets/…` → `/node_modules/…` →
 * jsDelivr CDN 순으로 시도한다. 프로덕션(커스텀 서버)·Docker·오프라인·CSP 환경에서는
 * `/node_modules/…`가 서빙되지 않고 CDN도 막혀 "Could not load mp4-wasm" 로 렌더가 통째로 실패한다.
 * `public/mp4-wasm.wasm`을 두면 첫 경로 `/mp4-wasm.wasm`에서 로컬로 해결되어 CDN 의존이 사라진다.
 *
 * postinstall에서 실행되므로 설치를 절대 실패시키지 않는다(경고만 남기고 종료 0).
 * 저장소에도 `public/mp4-wasm.wasm`을 커밋하므로, 이 스크립트가 못 돌아도 빌드는 안전하다.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(
  root,
  "node_modules",
  "@twick",
  "browser-render",
  "public",
  "mp4-wasm.wasm",
);
const destDir = join(root, "public");
const dest = join(destDir, "mp4-wasm.wasm");

try {
  await stat(src);
  await mkdir(destDir, { recursive: true });
  await copyFile(src, dest);
  console.log("[copy-mp4-wasm] public/mp4-wasm.wasm 갱신 완료");
} catch (err) {
  // 소스 부재(예: --omit 설치)·권한 등은 치명적이지 않다 — 커밋된 public 파일이 백업.
  console.warn(
    `[copy-mp4-wasm] 건너뜀: ${err instanceof Error ? err.message : String(err)}`,
  );
}
