"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";

import { appLog } from "@/lib/app-log";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth-store";

// 루트 레이아웃에서 한 번만 감싸는 클라이언트 프로바이더 묶음
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // F5 후에도 세션 복구: sessionStorage JWT + httpOnly refresh 쿠키
    void useAuthStore
      .getState()
      .hydrate()
      .then(() => {
        appLog("bootstrap", "hydrate 완료");
      });
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
