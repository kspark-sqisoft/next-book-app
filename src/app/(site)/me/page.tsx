import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MyInfoPage } from "@/page-components/MyInfoPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <MyInfoPage />
    </ProtectedRoute>
  );
}
