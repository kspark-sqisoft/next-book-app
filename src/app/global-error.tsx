"use client";

// 루트 레이아웃까지 무너지는 예외의 최후 방어선 — html/body를 직접 렌더해야 함
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>
          문제가 발생해 화면을 표시할 수 없습니다.
        </h2>
        <p style={{ fontSize: 13, color: "#666" }}>
          {error.digest ? `오류 코드: ${error.digest}` : error.message}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            borderRadius: 8,
            border: "1px solid #ddd",
            padding: "8px 16px",
            fontSize: 14,
            cursor: "pointer",
            background: "#fff",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
