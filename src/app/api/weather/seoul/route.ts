// 서울 고정 날씨(위젯용 단축 경로)
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { assertRateLimit, clientIpFromRequest } from "@/server/http/rate-limit";
import { WeatherService } from "@/server/services/weather.service";

export async function GET(request: Request) {
  try {
    // 공개 프록시 — 외부 API 쿼터 소진 방어
    assertRateLimit(`weather:${clientIpFromRequest(request)}`, 30, 60_000);
    const weather = new WeatherService();
    const data = await weather.getSeoulWeather();
    return NextResponse.json(data);
  } catch (e) {
    return handleRouteError(e);
  }
}
