// 개발 콘솔 전용(프로덕션은 no-op)

export function appLogSessionDivider(): void {
  if (process.env.NODE_ENV === "production") return;
  const line = "============================================================";
  console.warn(line);
  console.warn(
    "[react-auth:session] main.tsx 진입 (번들 로드 직후 · 아래부터 앱 초기화)",
  );
  console.warn(line);
}

// scope별 태그로 필터하기 쉽게
export function appLog(scope: string, message: string, detail?: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const tag = `[react-auth:${scope}]`;
  if (detail !== undefined) {
    console.log(tag, message, detail);
  } else {
    console.log(tag, message);
  }
}
