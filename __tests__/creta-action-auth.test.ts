import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 서버 액션은 액션 ID만 알면 호출 가능한 POST 엔드포인트다.
 * 크레타 도메인은 조회 액션 다수가 토큰을 받지 않아 화면 목록·광고 리포트·감사 로그가
 * 비로그인에 열려 있었다(2026-09-02 리뷰 P0-2). 같은 실수가 다시 들어오지 않게,
 * "인증을 부르지 않는 액션"은 아래 목록에 이유와 함께 등록해야만 통과하도록 고정한다.
 *
 * 신원은 이제 쿠키에서 읽는다(`@/server/auth/session`). 액션이 토큰을 인자로 받으면
 * 호출자가 신원을 주장할 수 있게 되므로, 그 형태가 되살아나지 않는 것도 함께 고정한다.
 */

const ACTIONS_DIR = join(process.cwd(), "src", "actions");

/**
 * 의도적으로 비로그인 허용하는 액션 — 각 항목은 왜 공개여야 하는지가 명확해야 한다.
 * 사이니지 단말은 별도 세션(대개 비로그인)으로 재생하므로 재생 경로는 열려 있어야 하고,
 * 커뮤니티는 공개 갤러리다.
 */
const INTENTIONALLY_PUBLIC = new Map<string, string>([
  // ── 재생 경로(단말이 로그인 없이 그린다) ──
  ["listCretaAdActiveCreativesAction", "화면이 지금 틀 소재를 알아야 함"],
  ["getCretaAdSettingAction", "루프 삽입·하우스 광고 설정은 재생에 필요"],
  ["getActiveCretaAlertAction", "긴급 알림은 모든 화면에 즉시 표시"],
  ["logCretaAdPlayAction", "Proof-of-Play 기록 — 단말이 비로그인으로 남긴다"],
  // ── 공개 커뮤니티 ──
  ["listCretaCommentsAction", "커뮤니티 댓글은 공개 콘텐츠"],
  ["listCretaCommentCountsAction", "갤러리 카드의 댓글 수"],
  ["listPublicCretaPlaylistsAction", "전체 공개만 반환하도록 서비스에서 필터"],
  ["getPublicCretaPlaylistAction", "전체 공개가 아니면 404"],
]);

const AUTH_CALL = /require(?:User|Admin)\(\)|getCurrentUser\(\)/;

/** 되살아나면 안 되는 형태: 신원을 인자로 받는 액션 */
const TOKEN_PARAM = /accessToken\s*:/;

type ActionFn = { file: string; name: string; body: string };

function collectActions(): ActionFn[] {
  const files = readdirSync(ACTIONS_DIR).filter((f) => f.startsWith("creta"));
  const out: ActionFn[] = [];
  for (const file of files) {
    const src = readFileSync(join(ACTIONS_DIR, file), "utf8");
    // 다음 `export ` 직전까지를 그 액션의 본문으로 본다
    const re = /^export async function ([A-Za-z0-9_]+Action)\b/gm;
    const starts: { name: string; at: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      starts.push({ name: m[1]!, at: m.index });
    }
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i]!;
      const end = i + 1 < starts.length ? starts[i + 1]!.at : src.length;
      out.push({ file, name: start.name, body: src.slice(start.at, end) });
    }
  }
  return out;
}

describe("크레타 서버 액션 인증 표면", () => {
  const actions = collectActions();

  it("액션을 실제로 수집한다(정규식이 조용히 빗나가지 않게)", () => {
    expect(actions.length).toBeGreaterThan(40);
  });

  it("허용 목록에 없는 액션은 반드시 인증을 호출한다", () => {
    const unguarded = actions
      .filter((a) => !AUTH_CALL.test(a.body))
      .filter((a) => !INTENTIONALLY_PUBLIC.has(a.name))
      .map((a) => `${a.file}: ${a.name}`);
    expect(unguarded).toEqual([]);
  });

  it("허용 목록은 실재하는 액션만 담는다(이름 오타·삭제 방치 방지)", () => {
    const names = new Set(actions.map((a) => a.name));
    const stale = [...INTENTIONALLY_PUBLIC.keys()].filter((n) => !names.has(n));
    expect(stale).toEqual([]);
  });

  it("어떤 액션도 토큰을 인자로 받지 않는다 — 신원은 쿠키에서만 온다", () => {
    const takesToken = actions
      .filter((a) => TOKEN_PARAM.test(a.body))
      .map((a) => `${a.file}: ${a.name}`);
    expect(takesToken).toEqual([]);
  });

  it("허용 목록의 액션은 실제로 인증을 호출하지 않는다(목록이 낡지 않게)", () => {
    const nowGuarded = actions
      .filter((a) => INTENTIONALLY_PUBLIC.has(a.name))
      .filter((a) => AUTH_CALL.test(a.body))
      .map((a) => a.name);
    expect(nowGuarded).toEqual([]);
  });
});
