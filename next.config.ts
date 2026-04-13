import { createRequire } from "node:module";
import path from "node:path";

import type { NextConfig } from "next";

/** react-konva·book-slide-snapshot 등이 서로 다른 해석 경로로 konva를 두 번 묶으면 "Several Konva instances" + 힙 낭비 */
const require = createRequire(import.meta.url);
/** `konva/package.json` 은 exports에 없어 resolve 불가 → 메인 엔트리(`lib/…`)의 상위가 패키지 루트 */
const konvaPackageRoot = path.resolve(
  path.dirname(require.resolve("konva")),
  "..",
);
/**
 * Turbopack은 resolveAlias에 절대 경로를 넣으면 `./app/node_modules/konva`처럼 깨져 빌드가 실패함.
 * npm/pnpm 기본 레이아웃에서 `node_modules/konva`는 이 경로로 해석된다.
 */
const konvaTurbopackAlias = "./node_modules/konva";

const nextConfig: NextConfig = {
  // Custom `server.ts` runs Next + Socket.IO on one port; standalone bundle targets the default server only.
  experimental: {
    serverActions: {
      // 기본 1MB — FormData·Server Action 업로드가 여기서 먼저 막힘. 앱별 maxBytes와 별개로 상한을 넉넉히 둠.
      bodySizeLimit: "1gb",
    },
  },
  turbopack: {
    resolveAlias: {
      konva: konvaTurbopackAlias,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    const a = config.resolve.alias;
    config.resolve.alias = {
      ...(typeof a === "object" && a !== null && !Array.isArray(a)
        ? (a as Record<string, string | false | string[]>)
        : {}),
      konva: konvaPackageRoot,
    };
    return config;
  },
};

export default nextConfig;
