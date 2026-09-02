// RSC: `/dashboard` — 크레타 운영 대시보드
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardPage } from "@/page-components/DashboardPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
