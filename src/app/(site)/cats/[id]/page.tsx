// RSC: `/cats/[id]` — 동적 세그먼트는 클라이언트에서 useParams로 읽음
import { CatDetailPage } from "@/page-components/CatDetailPage";

export default function Page() {
  return <CatDetailPage />;
}
