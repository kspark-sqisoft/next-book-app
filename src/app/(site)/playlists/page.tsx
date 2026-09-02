// RSC: `/playlists` — 크레타 플레이리스트 목록(뼈대)
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlaylistListPage } from "@/page-components/PlaylistListPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <PlaylistListPage />
    </ProtectedRoute>
  );
}
