"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/stores/auth-store";
import { appLog } from "@/lib/app-log";
import { CenteredSpinner } from "@/components/layout/CenteredSpinner";

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
      router.replace(`/login?from=${encodeURIComponent(path)}`);
    }
  }, [isReady, user, router]);

  if (!isReady) {
    return <CenteredSpinner />;
  }

  if (!user) {
    return <CenteredSpinner />;
  }

  return <>{children}</>;
}
