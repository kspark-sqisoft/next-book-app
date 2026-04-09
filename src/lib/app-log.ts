/**
 * 앱 주요 흐름 추적용 로그.
 * `import.meta.env.DEV`일 때만 출력되며, 프로덕션 빌드에서는 호출해도 아무 일도 하지 않습니다.
 */

/** 새로고침·최초 진입마다 한 번, 콘솔 로그 묶음을 시각적으로 나눕니다. (DEV 대신 !PROD — Vite에서 더 안정적) */
export function appLogSessionDivider(): void {
  if (process.env.NODE_ENV === "production") return;
  const line = "============================================================";
  console.warn(line);
  console.warn(
    "[react-auth:session] main.tsx 진입 (번들 로드 직후 · 아래부터 앱 초기화)",
  );
  console.warn(line);
}

export function appLog(scope: string, message: string, detail?: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const tag = `[react-auth:${scope}]`;
  if (detail !== undefined) {
    console.log(tag, message, detail);
  } else {
    console.log(tag, message);
  }
}
