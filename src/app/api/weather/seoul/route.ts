import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { WeatherService } from "@/server/services/weather.service";

export async function GET() {
  try {
    const weather = new WeatherService();
    const data = await weather.getSeoulWeather();
    return NextResponse.json(data);
  } catch (e) {
    return handleRouteError(e);
  }
}
