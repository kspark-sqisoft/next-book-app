import { AppLayout } from "@/components/layout/AppLayout";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
