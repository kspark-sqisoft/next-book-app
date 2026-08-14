// 뉴스 헤드라인: country, category, pageSize 쿼리
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { assertRateLimit, clientIpFromRequest } from "@/server/http/rate-limit";
import { NewsService } from "@/server/services/news.service";

export async function GET(request: Request) {
  try {
    // 공개 북 뷰의 위젯이 호출하므로 인증은 걸지 않되, 외부 API 쿼터 소진은 IP 리밋으로 방어
    assertRateLimit(`news:${clientIpFromRequest(request)}`, 30, 60_000);
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
