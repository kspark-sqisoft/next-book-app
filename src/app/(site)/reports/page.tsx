// RSC: `/reports` — 재생 리포트(Proof-of-Play)
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlayReportPage } from "@/page-components/PlayReportPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <PlayReportPage />
    </ProtectedRoute>
  );
}
