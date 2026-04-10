// OpenWeather: 지오코딩·현재 날씨·서울 단축
import { HttpError } from "@/server/http/http-error";

const SEOUL_LAT = 37.5665;
const SEOUL_LON = 126.978;
const SEOUL_LABEL = "서울";

type OwmWeatherJson = {
  weather?: { description?: string; icon?: string }[];
  main?: {
    temp?: number;
    feels_like?: number;
    humidity?: number;
  };
  wind?: { speed?: number };
};

type OwmAirJson = {
  list?: {
    main?: { aqi?: number };
    components?: { pm2_5?: number; pm10?: number };
  }[];
};

type OwmGeoItem = {
  name?: string;
  country?: string;
  lat?: number;
  lon?: number;
};

export type SeoulWeatherDto = {
  locationLabel: string;
  tempC: number;
  feelsLikeC: number;
  description: string;
  icon: string;
  humidity: number;
  windMps: number;
  pm25: number | null;
  pm10: number | null;
  aqiLevel: number | null;
  aqiLabel: string | null;
  updatedAt: string;
};

function aqiToKorean(
  aqi: number | undefined,
): { level: number; label: string } | null {
  if (aqi == null || !Number.isFinite(aqi)) return null;
  const level = Math.min(5, Math.max(1, Math.round(aqi)));
  const labels: Record<number, string> = {
    1: "좋음",
    2: "보통",
    3: "보통",
    4: "나쁨",
    5: "매우 나쁨",
  };
  return { level, label: labels[level] ?? "알 수 없음" };
}

export class WeatherService {
  private apiKey(): string {
    const key = process.env.OPENWEATHERMAP_API_KEY?.trim();
    if (!key) {
      throw new HttpError(
        503,
        "OPENWEATHERMAP_API_KEY가 설정되지 않았습니다. 백엔드 환경 변수를 확인하세요.",
      );
    }
    return key;
  }

  private async resolveLatLon(
    q: string | undefined,
    key: string,
  ): Promise<{ lat: number; lon: number; locationLabel: string }> {
    const t = q?.trim();
    if (!t) {
      return { lat: SEOUL_LAT, lon: SEOUL_LON, locationLabel: SEOUL_LABEL };
    }
    if (t.length > 120) {
      throw new HttpError(400, "도시 검색어가 너무 깁니다.");
    }
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(t)}&limit=1&appid=${encodeURIComponent(key)}`;
    let res: Response;
    try {
      res = await fetch(geoUrl);
    } catch {
      throw new HttpError(502, "도시 정보를 가져오지 못했습니다.");
    }
    if (!res.ok) {
      throw new HttpError(502, "도시 정보를 가져오지 못했습니다.");
    }
    const arr = (await res.json()) as OwmGeoItem[];
    const g = arr?.[0];
    if (
      !g ||
      typeof g.lat !== "number" ||
      typeof g.lon !== "number" ||
      !Number.isFinite(g.lat) ||
      !Number.isFinite(g.lon)
    ) {
      throw new HttpError(
        400,
        "도시를 찾을 수 없습니다. 예: Seoul,KR · Busan,KR · Tokyo,JP",
      );
    }
    const name = typeof g.name === "string" ? g.name : t;
    const country = typeof g.country === "string" ? g.country : "";
    const locationLabel = country ? `${name}, ${country}` : name;
    return { lat: g.lat, lon: g.lon, locationLabel };
  }

  async getWeather(q?: string): Promise<SeoulWeatherDto> {
    const key = this.apiKey();
    const { lat, lon, locationLabel } = await this.resolveLatLon(q, key);

    const weatherUrl =
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}` +
      `&appid=${encodeURIComponent(key)}&units=metric&lang=kr`;
    const airUrl =
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}` +
      `&appid=${encodeURIComponent(key)}`;

    let weatherJson: OwmWeatherJson;
    try {
      const res = await fetch(weatherUrl);
      if (!res.ok) throw new Error(`weather ${res.status}`);
      weatherJson = (await res.json()) as OwmWeatherJson;
    } catch {
      throw new HttpError(502, "날씨 정보를 가져오지 못했습니다.");
    }

    const w0 = weatherJson.weather?.[0];
    const description =
      typeof w0?.description === "string" ? w0.description : "";
    const icon = typeof w0?.icon === "string" ? w0.icon : "01d";
    const main = weatherJson.main;
    const tempC = typeof main?.temp === "number" ? main.temp : 0;
    const feelsLikeC =
      typeof main?.feels_like === "number" ? main.feels_like : tempC;
    const humidity = typeof main?.humidity === "number" ? main.humidity : 0;
    const windMps =
      typeof weatherJson.wind?.speed === "number" ? weatherJson.wind.speed : 0;

    let pm25: number | null = null;
    let pm10: number | null = null;
    let aqiLevel: number | null = null;
    let aqiLabel: string | null = null;

    try {
      const ares = await fetch(airUrl);
      if (ares.ok) {
        const airJson = (await ares.json()) as OwmAirJson;
        const row = airJson.list?.[0];
        const comp = row?.components;
        if (typeof comp?.pm2_5 === "number") pm25 = comp.pm2_5;
        if (typeof comp?.pm10 === "number") pm10 = comp.pm10;
        const aqi = row?.main?.aqi;
        const mapped = aqiToKorean(aqi);
        if (mapped) {
          aqiLevel = mapped.level;
          aqiLabel = mapped.label;
        }
      }
    } catch {
      /* ignore */
    }

    return {
      locationLabel,
      tempC,
      feelsLikeC,
      description,
      icon,
      humidity,
      windMps,
      pm25,
      pm10,
      aqiLevel,
      aqiLabel,
      updatedAt: new Date().toISOString(),
    };
  }

  async getSeoulWeather(): Promise<SeoulWeatherDto> {
    return this.getWeather(undefined);
  }
}
