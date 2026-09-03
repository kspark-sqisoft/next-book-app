import path from "node:path";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/** Next.js App Router — 공식: https://nextjs.org/docs/app/guides/testing/vitest */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // `server-only`는 react-server 조건에서만 빈 모듈로 해석되고 그 밖에서는 즉시 throw 한다.
      // Next는 내부적으로 처리하지만 vitest는 그 조건을 켜지 않으므로(켜면 React 해석까지
      // 바뀌어 jsdom 렌더 테스트가 깨진다) 패키지가 제공하는 빈 모듈로 직접 연결한다.
      "server-only": path.resolve(
        import.meta.dirname,
        "node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    environment: "jsdom",
    exclude: [
      "**/node_modules/**",
      "**/e2e/**",
      "**/.next/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
});
