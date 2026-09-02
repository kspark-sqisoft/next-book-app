// RSC: `/walls` — 비디오월 목록
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { WallListPage } from "@/page-components/WallListPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <WallListPage />
    </ProtectedRoute>
  );
}
