// 내 정보: 비로그인 시 ProtectedRoute 가 로그인으로 보냄
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MyInfoPage } from "@/page-components/MyInfoPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <MyInfoPage />
    </ProtectedRoute>
  );
}
