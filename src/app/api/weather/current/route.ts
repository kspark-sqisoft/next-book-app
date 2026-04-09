import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { WeatherService } from "@/server/services/weather.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const weather = new WeatherService();
    const data = await weather.getWeather(q);
    return NextResponse.json(data);
  } catch (e) {
    return handleRouteError(e);
  }
}
