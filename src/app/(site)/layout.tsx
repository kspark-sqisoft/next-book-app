// (site) 그룹: 헤더·푸터·메인 스크롤 영역을 공통으로 씌움
import { AppLayout } from "@/components/layout/AppLayout";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
