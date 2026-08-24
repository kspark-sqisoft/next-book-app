/**
 * 디바이스 상세 "로그" 예시 데이터 — 실제 수집 로그가 아니라 정상 작동/문제 발생 판별 UI를 보여 주기 위한 샘플.
 * 디바이스 id로 시드를 잡아 새로고침해도 같은 내용이 나오고, 전원 예약 시각이 있으면 기동·종료 시각에 반영합니다.
 */

export type DeviceSampleLogLevel = "info" | "warn" | "error";

export type DeviceSampleLogEntry = {
  /** "HH:MM:SS" */
  time: string;
  level: DeviceSampleLogLevel;
  /** 이벤트 코드(예: BOOT, NET_LATENCY) */
  event: string;
  message: string;
};

export const DEVICE_SAMPLE_LOG_LEVEL_LABEL: Record<
  DeviceSampleLogLevel,
  string
> = {
  info: "정상",
  warn: "경고",
  error: "이상",
};

/** 결정적 의사난수(mulberry32) — 같은 시드면 같은 순서 */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hhmmss(totalSec: number): string {
  const s = ((totalSec % 86400) + 86400) % 86400;
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

function parseHHMMToSec(
  t: string | null | undefined,
  fallbackSec: number,
): number {
  const m = /^(\d{2}):(\d{2})$/.exec(t ?? "");
  if (!m) return fallbackSec;
  return Number(m[1]) * 3600 + Number(m[2]) * 60;
}

/** 로컬 날짜 → "YYYY-MM-DD" */
export function deviceLogDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 오늘부터 과거 n일(오늘 포함)의 날짜 키 — 최신순 */
export function recentDeviceLogDateKeys(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(deviceLogDateKey(d));
  }
  return out;
}

function dateSeed(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function buildDeviceSampleLog(input: {
  deviceId: number;
  online: boolean;
  powerOnTime?: string | null;
  powerOffTime?: string | null;
  sourceTitle?: string | null;
  /** 어느 날의 로그인지(YYYY-MM-DD). 생략 시 오늘. 날짜마다 내용이 달라진다 */
  date?: string;
}): DeviceSampleLogEntry[] {
  const dateKey = input.date ?? deviceLogDateKey(new Date());
  const rnd = seededRandom(
    ((input.deviceId * 7919 + 17) ^ dateSeed(dateKey)) >>> 0,
  );
  const jitter = (max: number) => Math.floor(rnd() * max);
  const bootSec = parseHHMMToSec(input.powerOnTime, 9 * 3600);
  const offSec = parseHHMMToSec(input.powerOffTime, 18 * 3600);
  const source = input.sourceTitle?.trim() || "지정된 재생 소스 없음";

  const out: DeviceSampleLogEntry[] = [
    {
      time: hhmmss(bootSec + jitter(8)),
      level: "info",
      event: "BOOT",
      message: `정상 기동 시작 (예약 ${hhmmss(bootSec).slice(0, 5)})`,
    },
    {
      time: hhmmss(bootSec + 20 + jitter(25)),
      level: "info",
      event: "NET_UP",
      message: `네트워크 연결됨 · 서버 동기화 완료 (RTT ${18 + jitter(40)}ms)`,
    },
    {
      time: hhmmss(bootSec + 50 + jitter(30)),
      level: "info",
      event: "SOURCE_LOAD",
      message: `재생 소스 로드 완료 — ${source}`,
    },
    {
      time: hhmmss(bootSec + 95 + jitter(20)),
      level: "info",
      event: "PLAY",
      message: "재생 시작 · 화면 출력 정상",
    },
  ];

  // 오전·오후 경고/이상 — 날짜에 따라 있는 날·없는 날이 섞이도록
  const midSec = bootSec + Math.floor((offSec - bootSec) * (0.3 + rnd() * 0.2));
  if (rnd() > 0.3) {
    const latency = 600 + jitter(900);
    out.push({
      time: hhmmss(midSec + jitter(600)),
      level: "warn",
      event: "NET_LATENCY",
      message: `네트워크 지연 ${latency}ms (임계 500ms 초과) · 캐시된 콘텐츠로 재생 유지`,
    });
  } else {
    out.push({
      time: hhmmss(midSec + jitter(600)),
      level: "info",
      event: "SYNC",
      message: `콘텐츠 동기화 완료 · 변경 ${jitter(4)}건 반영`,
    });
  }
  const afterSec =
    bootSec + Math.floor((offSec - bootSec) * (0.55 + rnd() * 0.2));
  if (rnd() > 0.45) {
    const retries = 1 + jitter(3);
    out.push({
      time: hhmmss(afterSec),
      level: "error",
      event: "CONTENT_FAIL",
      message: `콘텐츠 로드 실패 (HTTP 504) — 재시도 ${retries}회`,
    });
    out.push({
      time: hhmmss(afterSec + 12 + retries * 6),
      level: "info",
      event: "RECOVERED",
      message: `재시도 성공 · 재생 복구 (중단 ${12 + retries * 6}초)`,
    });
  } else {
    out.push({
      time: hhmmss(afterSec),
      level: "info",
      event: "HEALTH_CHECK",
      message: "자가 진단 정상 · 디스플레이 출력·오디오 정상",
    });
  }
  if (rnd() > 0.5) {
    out.push({
      time: hhmmss(afterSec + 1800 + jitter(1200)),
      level: "warn",
      event: "TEMP_HIGH",
      message: `장치 온도 ${62 + jitter(9)}°C (권장 60°C 이하) · 팬 속도 상향`,
    });
  }
  out.push({
    time: hhmmss(offSec - 30 - jitter(20)),
    level: "info",
    event: "HEARTBEAT",
    message: `상태 보고 정상 · 가동 ${Math.floor((offSec - bootSec) / 3600)}시간 ${Math.floor(((offSec - bootSec) % 3600) / 60)}분`,
  });
  out.push({
    time: hhmmss(offSec + jitter(5)),
    level: input.online ? "info" : "warn",
    event: "SHUTDOWN",
    message: input.online
      ? `예약 종료 — 화면 끄기 (예약 ${hhmmss(offSec).slice(0, 5)})`
      : "예약 종료 — 이후 상태 보고 없음(연결 끊김)",
  });

  return out.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}
