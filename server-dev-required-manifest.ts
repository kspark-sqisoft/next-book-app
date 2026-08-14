import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function devDistDir(cwd: string, distDir: string): string {
  return path.join(cwd, distDir, "dev");
}

/**
 * Turbopack/webpack 첫 컴파일이 `.next/dev` 를 비운 뒤 manifest 를 아직 안 쓴 틈에 요청이 들어오면 ENOENT 가 난다.
 * `loadConfig` 없이 동기로 최소 본문만 써서 그 레이스를 막는다.
 */
export function ensureDevRequiredServerFilesManifestSync(
  cwd: string = process.cwd(),
  distDir: string = ".next",
): void {
  if (process.env.NODE_ENV === "production") return;

  const dir = devDistDir(cwd, distDir);
  const jsonPath = path.join(dir, "required-server-files.json");
  if (existsSync(jsonPath)) return;

  mkdirSync(dir, { recursive: true });
  const manifest = {
    version: 1 as const,
    config: {
      distDir,
      cacheHandlers: {} as Record<string, never>,
      experimental: {
        trustHostHeader: false,
        isExperimentalCompile: false,
      },
    },
    appDir: cwd,
    relativeAppDir: ".",
    files: [] as string[],
    ignore: [] as string[],
  };
  const pretty = JSON.stringify(manifest, null, 2);
  writeFileSync(jsonPath, pretty, "utf8");
  writeFileSync(
    path.join(dir, "required-server-files.js"),
    `self.__SERVER_FILES_MANIFEST=${pretty}`,
    "utf8",
  );
  writeFileSync(path.join(dir, "BUILD_ID"), "development", "utf8");
}

/**
 * 기동 시 한 번: 실제 next.config 기반 runtime config 로 manifest 채움(더 정확함).
 * 조기 return 없음 — 파일이 있어도 덮어써서 빈/깨진 볼륨 상태를 정리한다.
 */
export async function ensureDevRequiredServerFilesManifest(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const dir = process.cwd();
  const [{ default: loadConfig }, { getNextConfigRuntime }, { PHASE_DEVELOPMENT_SERVER }] =
    await Promise.all([
      import("next/dist/server/config.js"),
      import("next/dist/server/config-shared.js"),
      import("next/dist/shared/lib/constants.js"),
    ]);

  const config = await loadConfig(PHASE_DEVELOPMENT_SERVER, dir);
  const distRoot = devDistDir(dir, config.distDir);
  const jsonPath = path.join(distRoot, "required-server-files.json");
  const jsPath = path.join(distRoot, "required-server-files.js");
  const buildIdPath = path.join(distRoot, "BUILD_ID");

  await mkdir(distRoot, { recursive: true });

  const runtime = getNextConfigRuntime(config);
  let base: Record<string, unknown>;
  try {
    base = JSON.parse(JSON.stringify(runtime)) as Record<string, unknown>;
  } catch {
    base = { distDir: config.distDir, experimental: {} };
  }
  delete base.configFile;

  const experimental =
    typeof base.experimental === "object" && base.experimental !== null
      ? { ...(base.experimental as Record<string, unknown>) }
      : {};

  const manifest = {
    version: 1 as const,
    config: {
      ...base,
      cacheHandlers: {},
      experimental: {
        ...experimental,
        trustHostHeader: false,
        isExperimentalCompile: false,
      },
    },
    appDir: dir,
    relativeAppDir: ".",
    files: [] as string[],
    ignore: [] as string[],
  };

  const pretty = JSON.stringify(manifest, null, 2);
  await writeFile(jsonPath, pretty, "utf8");
  await writeFile(jsPath, `self.__SERVER_FILES_MANIFEST=${pretty}`, "utf8");
  await writeFile(buildIdPath, "development", "utf8");
}

/** 요청 핸들러에서 쓰기: 파일 없을 때만 동기 보강 */
export function ensureDevRequiredServerFilesIfMissing(): void {
  ensureDevRequiredServerFilesManifestSync();
}
