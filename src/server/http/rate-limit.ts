// IP(또는 임의 키) 기반 고정 윈도우 레이트 리밋 — 단일 인스턴스용 인메모리.
// 다중 인스턴스로 확장하면 Redis 등 공유 저장소로 교체할 것.
import { HttpError } from "@/server/http/http-error";

type Bucket = { n: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000; // 무한 증식 방지 상한

function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}

/** limit 초과 시 429 HttpError를 던진다. */
export function assertRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): void {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt < now) {
    sweep(now);
    buckets.set(key, { n: 1, resetAt: now + windowMs });
    return;
  }
  cur.n += 1;
  if (cur.n > limit) {
    throw new HttpError(429, "요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
  }
}

/** 프록시 뒤에서도 동작하는 베스트에포트 클라이언트 IP 추출 */
export function clientIpFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
