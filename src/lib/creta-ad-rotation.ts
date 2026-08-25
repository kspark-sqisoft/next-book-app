// 광고 로테이션 — 구좌 위젯과 디바이스 광고 전용 루프가 같은 규칙으로 순환하도록 공유한다.
import type { CretaAdActiveCreative } from "@/lib/creta-ads-api";

/**
 * 가중 로테이션 순서 — 캠페인별 큐에서 라운드로빈으로 하나씩 뽑아
 * 같은 캠페인 소재가 연속되지 않게 섞는다(가중치 = 큐 투입 횟수).
 */
export function buildCretaAdRotation(
  creatives: CretaAdActiveCreative[],
): CretaAdActiveCreative[] {
  const byCampaign = new Map<number, CretaAdActiveCreative[]>();
  for (const c of creatives) {
    const list = byCampaign.get(c.campaignId) ?? [];
    for (let i = 0; i < Math.max(1, c.weight); i++) list.push(c);
    byCampaign.set(c.campaignId, list);
  }
  const queues = [...byCampaign.values()];
  const out: CretaAdActiveCreative[] = [];
  let remaining = queues.reduce((a, q) => a + q.length, 0);
  let qi = 0;
  while (remaining > 0) {
    const q = queues[qi % queues.length];
    const item = q.shift();
    if (item) {
      out.push(item);
      remaining--;
    }
    qi++;
  }
  return out;
}

/**
 * 공통 클록 기준 현재 순번 — 같은 소재를 여러 화면이 동시에 봐도 같은 것이 나온다.
 * `spotSec` 마다 한 칸씩 넘어간다.
 */
export function cretaAdRotationIndex(
  rotationLength: number,
  spotSec: number,
): number {
  if (rotationLength <= 0) return 0;
  return (
    Math.floor(Date.now() / (Math.max(1, spotSec) * 1000)) % rotationLength
  );
}
