// RSC: `/playlists/[id]` — 동적 세그먼트는 클라이언트에서 useParams로 읽음
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlaylistDetailPage } from "@/page-components/PlaylistDetailPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <PlaylistDetailPage />
    </ProtectedRoute>
  );
}
