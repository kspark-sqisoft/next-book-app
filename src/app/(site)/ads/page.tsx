// RSC: `/ads` — 광고 관리(광고주·캠페인·소재)
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdsPage } from "@/page-components/AdsPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <AdsPage />
    </ProtectedRoute>
  );
}
