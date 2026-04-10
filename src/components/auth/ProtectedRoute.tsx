"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
import { appLog } from "@/lib/app-log";
import { useAuth } from "@/stores/auth-store";

// hydrate 전·리다이렉트 중에는 스피너만
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !user) {
      appLog("route", "보호 경로 — 비로그인, 로그인으로 이동");
    }
  }, [isReady, user]);

  useEffect(() => {
    if (isReady && !user) {
      const path = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?from=${encodeURIComponent(path)}`); // 돌아올 URL 보존
    }
  }, [isReady, user, router]);

  if (!isReady) {
    return <CenteredSpinner />;
  }

  if (!user) {
    return <CenteredSpinner />; // replace 직전 한 프레임
  }

  return <>{children}</>;
}
