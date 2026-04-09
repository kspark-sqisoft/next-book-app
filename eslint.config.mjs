import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  /**
   * `page-components`·`providers`·`stores`는 클라이언트 전용으로 간주합니다.
   * `@/server`를 직접 import하면 번들에 서버 코드가 섞일 수 있습니다.
   */
  {
    files: [
      "src/page-components/**/*.tsx",
      "src/app/providers.tsx",
      "src/stores/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/server(/|$)",
              message:
                "클라이언트 번들에서는 @/server를 import할 수 없습니다. Route Handler, Server Action, tRPC 등 서버 전용 경로를 사용하세요.",
            },
          ],
        },
      ],
    },
  },
  /** 북 워크스페이스·라이브러리 썸네일은 blob/data/임의 URL이 많아 `next/image` 대신 `<img>` 유지 */
  {
    files: [
      "src/components/books/**/*.tsx",
      "src/components/ui/safe-image.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
