// 레거시 /edit URL 은 상세(편집 통합)로 통일
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/books/${id}`);
}
