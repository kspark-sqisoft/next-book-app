// 날씨: 쿼리 q(도시명 등) 선택적
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { assertRateLimit, clientIpFromRequest } from "@/server/http/rate-limit";
import { WeatherService } from "@/server/services/weather.service";

export async function GET(request: Request) {
  try {
    // 공개 북 뷰의 위젯이 호출하므로 인증은 걸지 않되, 외부 API 쿼터 소진은 IP 리밋으로 방어
    assertRateLimit(`weather:${clientIpFromRequest(request)}`, 30, 60_000);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const weather = new WeatherService();
    const data = await weather.getWeather(q);
    return NextResponse.json(data);
  } catch (e) {
    return handleRouteError(e);
  }
}
