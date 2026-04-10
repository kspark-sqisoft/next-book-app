// 새 북 편집기: 로그인 필수
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { BookEditorPage } from "@/page-components/BookEditorPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <BookEditorPage />
    </ProtectedRoute>
  );
}
