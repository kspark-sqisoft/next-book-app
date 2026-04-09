import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PostEditorPage } from "@/page-components/PostEditorPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <PostEditorPage />
    </ProtectedRoute>
  );
}
