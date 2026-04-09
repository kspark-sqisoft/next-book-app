import { HttpError } from "@/server/http/http-error";

const CATEGORIES = new Set([
  "business",
  "entertainment",
  "general",
  "health",
  "science",
  "sports",
  "technology",
]);

type NewsApiArticleRow = {
  title?: string | null;
  url?: string | null;
  source?: { name?: string | null };
  publishedAt?: string | null;
};

type NewsApiJson = {
  status?: string;
  code?: string;
  message?: string;
  totalResults?: number;
  articles?: NewsApiArticleRow[];
};

const EVERYTHING_Q_BY_COUNTRY: Record<string, string> = {
  kr: "Korea",
  us: "United States",
  jp: "Japan",
  cn: "China",
  tw: "Taiwan",
  gb: "United Kingdom",
  de: "Germany",
  fr: "France",
  in: "India",
  br: "Brazil",
  au: "Australia",
  ca: "Canada",
  ru: "Russia",
  it: "Italy",
  es: "Spain",
  mx: "Mexico",
  nl: "Netherlands",
  se: "Sweden",
  ch: "Switzerland",
};

const EVERYTHING_LANG_BY_COUNTRY: Record<string, string> = {
  kr: "ko",
  jp: "ja",
  cn: "zh",
  tw: "zh",
  gb: "en",
  us: "en",
};

export type NewsArticleDto = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
};

export type NewsHeadlinesResponseDto = {
  articles: NewsArticleDto[];
  fetchedAt: string;
};

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function isRedactedOrEmptyNewsTitle(title: string): boolean {
  if (!title.trim()) return true;
  const normalized = title
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length === 0 || /^removed$/i.test(normalized);
}

function safeHttpUrl(u: string): string | null {
  try {
    const x = new URL(u);
    if (x.protocol !== "http:" && x.protocol !== "https:") return null;
    return x.href.slice(0, 2048);
  } catch {
    return null;
  }
}

export class NewsService {
  private mapRawArticles(
    rawList: NewsApiArticleRow[],
    pageSize: number,
  ): NewsArticleDto[] {
    const articles: NewsArticleDto[] = [];
    for (const a of rawList) {
      if (articles.length >= pageSize) break;
      const title = typeof a.title === "string" ? sanitizeTitle(a.title) : "";
      if (isRedactedOrEmptyNewsTitle(title)) continue;
      const urlStr = typeof a.url === "string" ? safeHttpUrl(a.url) : null;
      if (!urlStr) continue;
      const source =
        typeof a.source?.name === "string" && a.source.name.trim()
          ? a.source.name.trim().slice(0, 120)
          : "출처 미상";
      const publishedAt =
        typeof a.publishedAt === "string" && a.publishedAt.length > 0
          ? a.publishedAt.slice(0, 40)
          : new Date().toISOString();
      articles.push({ title, url: urlStr, source, publishedAt });
    }
    return articles;
  }

  private apiKey(): string {
    const key = process.env.NEWSAPI_KEY?.trim();
    if (!key) {
      throw new HttpError(
        503,
        "NEWSAPI_KEY가 설정되지 않았습니다. 백엔드 .env에 NewsAPI 키를 넣어 주세요.",
      );
    }
    return key;
  }

  private async fetchEverythingFallback(
    country: string,
    pageSize: number,
    key: string,
  ): Promise<NewsApiArticleRow[]> {
    const q = EVERYTHING_Q_BY_COUNTRY[country] ?? "world news";
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const ask = Math.min(30, Math.max(pageSize * 3, 12));

    const run = async (
      withLang: string | undefined,
    ): Promise<NewsApiArticleRow[]> => {
      const params = new URLSearchParams({
        q,
        from,
        sortBy: "publishedAt",
        pageSize: String(ask),
        apiKey: key,
      });
      if (withLang) params.set("language", withLang);

      const url = `https://newsapi.org/v2/everything?${params.toString()}`;

      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        return [];
      }

      let json: NewsApiJson;
      try {
        json = (await res.json()) as NewsApiJson;
      } catch {
        return [];
      }

      if (json.status === "error" || !res.ok) {
        return [];
      }

      return Array.isArray(json.articles) ? json.articles : [];
    };

    const lang = EVERYTHING_LANG_BY_COUNTRY[country];
    let rows = await run(lang);
    if (rows.length === 0 && lang) {
      rows = await run(undefined);
    }
    return rows;
  }

  async getHeadlines(
    countryRaw?: string,
    categoryRaw?: string,
    pageSizeRaw?: number,
  ): Promise<NewsHeadlinesResponseDto> {
    const key = this.apiKey();
    const country = (
      countryRaw?.trim().toLowerCase().slice(0, 2) || "kr"
    ).replace(/[^a-z]/g, "");
    if (country.length !== 2) {
      throw new HttpError(
        400,
        "country는 ISO 3166-1 alpha-2 두 글자여야 합니다.",
      );
    }

    let category = "";
    if (categoryRaw?.trim()) {
      const c = categoryRaw.trim().toLowerCase();
      if (!CATEGORIES.has(c)) {
        throw new HttpError(
          400,
          `category는 ${[...CATEGORIES].join(", ")} 중 하나여야 합니다.`,
        );
      }
      category = c;
    }

    const pageSize = Math.min(
      10,
      Math.max(1, Math.round(Number(pageSizeRaw) || 5)),
    );

    const fetchTopHeadlines = async (cat: string) => {
      const params = new URLSearchParams({
        country,
        pageSize: String(pageSize),
        apiKey: key,
      });
      if (cat) params.set("category", cat);

      const url = `https://newsapi.org/v2/top-headlines?${params.toString()}`;

      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        throw new HttpError(502, "뉴스 API에 연결하지 못했습니다.");
      }

      let json: NewsApiJson;
      try {
        json = (await res.json()) as NewsApiJson;
      } catch {
        throw new HttpError(502, "뉴스 응답을 해석하지 못했습니다.");
      }

      if (json.status === "error") {
        const msg = json.message ?? json.code ?? "unknown";
        throw new HttpError(
          502,
          typeof msg === "string" && msg.length > 0
            ? `NewsAPI: ${msg}`
            : "뉴스를 가져오지 못했습니다.",
        );
      }

      if (!res.ok) {
        throw new HttpError(502, "뉴스를 가져오지 못했습니다.");
      }

      return Array.isArray(json.articles) ? json.articles : [];
    };

    let rawList = await fetchTopHeadlines(category);
    let articles: NewsArticleDto[] = this.mapRawArticles(rawList, pageSize);

    if (articles.length === 0 && category && rawList.length === 0) {
      rawList = await fetchTopHeadlines("");
      articles = this.mapRawArticles(rawList, pageSize);
    }

    if (articles.length === 0 && rawList.length === 0) {
      rawList = await this.fetchEverythingFallback(country, pageSize, key);
      articles = this.mapRawArticles(rawList, pageSize);
    }

    return {
      articles,
      fetchedAt: new Date().toISOString(),
    };
  }
}
