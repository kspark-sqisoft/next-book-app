// RSC: `/devices` — 크레타 디바이스 목록(뼈대)
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DeviceListPage } from "@/page-components/DeviceListPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <DeviceListPage />
    </ProtectedRoute>
  );
}
