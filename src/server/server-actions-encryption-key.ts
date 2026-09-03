/**
 * `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 검증.
 *
 * Next는 서버 액션의 클로저 변수를 클라이언트로 보내기 전에 암호화하고, 키를 주지 않으면
 * **빌드마다 새 키를 만든다**. 인스턴스가 둘 이상이거나 재배포가 겹치면 A가 암호화한 액션
 * 참조를 B가 풀지 못해 "Failed to find Server Action"으로 진행 중인 변경이 실패한다.
 * 이 저장소는 커스텀 서버(`server.ts` + socket.io)로 자체 호스팅하므로 해당된다.
 *
 * 키는 **빌드 산출물에 박히므로** `next build` 시점에 있어야 한다. 그래서 서버 기동이 아니라
 * `next.config.ts`에서 부른다 — 빌드와 기동 양쪽에서 평가되는 유일한 지점이다.
 *
 * 요구 형식(Next 문서 self-hosting): base64이면서 디코드 길이가 AES 키 길이(16·24·32바이트).
 */

/** AES 키로 유효한 바이트 길이 */
const VALID_AES_KEY_BYTES = [16, 24, 32] as const;

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export const SERVER_ACTIONS_ENCRYPTION_KEY_ENV =
  "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY";

export type KeyProblem = "missing" | "not-base64" | "bad-length";

export type KeyInspection =
  | { ok: true; bytes: number }
  | { ok: false; problem: KeyProblem; message: string };

/** 생성 방법 안내 — 32바이트 키 */
export const KEY_HINT = "생성: openssl rand -base64 32";

/** 값 하나를 판정한다(프로세스 상태에 의존하지 않아 테스트 가능). */
export function inspectServerActionsEncryptionKey(
  raw: string | undefined | null,
): KeyInspection {
  const v = raw?.trim();
  if (!v) {
    return {
      ok: false,
      problem: "missing",
      message: `${SERVER_ACTIONS_ENCRYPTION_KEY_ENV} 미설정 — 빌드마다 키가 바뀌어 다중 인스턴스·재배포에서 서버 액션이 실패합니다. ${KEY_HINT}`,
    };
  }
  if (!BASE64_RE.test(v)) {
    return {
      ok: false,
      problem: "not-base64",
      message: `${SERVER_ACTIONS_ENCRYPTION_KEY_ENV} 가 base64가 아닙니다. ${KEY_HINT}`,
    };
  }
  const bytes = Buffer.from(v, "base64").length;
  if (
    !VALID_AES_KEY_BYTES.includes(bytes as (typeof VALID_AES_KEY_BYTES)[number])
  ) {
    return {
      ok: false,
      problem: "bad-length",
      message: `${SERVER_ACTIONS_ENCRYPTION_KEY_ENV} 의 디코드 길이가 ${bytes}바이트입니다 — AES 키는 16·24·32바이트여야 합니다. ${KEY_HINT}`,
    };
  }
  return { ok: true, bytes };
}

/**
 * 프로덕션은 기동·빌드를 세우고, 개발은 경고만 한다.
 *
 * 개발에서 미설정을 통과시키는 이유: Next가 빌드마다 키를 만들어 주고 단일 프로세스에서는
 * 문제가 없다. 반대로 **값이 있는데 형식이 틀린 경우**는 개발에서도 경고한다 — 프로덕션에
 * 그대로 복사되면 기동이 막히기 때문이다.
 */
export function assertServerActionsEncryptionKey(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const result = inspectServerActionsEncryptionKey(
    env[SERVER_ACTIONS_ENCRYPTION_KEY_ENV],
  );
  if (result.ok) return;

  if (env.NODE_ENV === "production") {
    throw new Error(result.message);
  }
  if (result.problem !== "missing") {
    console.warn(`[env] ${result.message}`);
  }
}
