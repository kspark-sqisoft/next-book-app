// 뉴스 헤드라인: country, category, pageSize 쿼리
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { NewsService } from "@/server/services/news.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const pageSizeRaw = searchParams.get("pageSize");
    const pageSize = pageSizeRaw != null ? Number(pageSizeRaw) : undefined;
    const news = new NewsService();
    const data = await news.getHeadlines(country, category, pageSize);
    return NextResponse.json(data);
  } catch (e) {
    return handleRouteError(e);
  }
}
