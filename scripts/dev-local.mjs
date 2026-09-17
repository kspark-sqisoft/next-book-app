#!/usr/bin/env node
/**
 * 로컬 소스 dev 서버 — `npm run dev:local`
 *
 * 이유: localhost:3000 은 `docker compose up` 으로 띄운 빌드 컨테이너라 소스 변경이 반영되지 않는다.
 * 매번 Docker 로 배포하지 않고도 바로 확인할 수 있게, 같은 DB(Docker Postgres 5432)를 쓰는
 * dev 서버를 다른 포트(기본 3001)로 띄운다.
 *
 * - PORT: 기본 3001. `PORT=3002 npm run dev:local` 처럼 덮어쓸 수 있다.
 * - HOSTNAME: Git Bash 는 이 변수에 PC 이름을 넣어 server.ts 가 그 호스트에 바인딩되고
 *   localhost 접속이 막힌다. 어떤 셸에서든 동일하게 0.0.0.0 으로 고정한다.
 *
 * npm 스크립트는 Windows 에서 cmd.exe 로 실행되므로 `PORT=3001 tsx server.ts` 같은
 * POSIX 문법 대신 Node 로 환경변수를 넣고 tsx CLI 를 직접 실행한다(추가 의존성 없음).
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");

const port = process.env.PORT || "3001";
const env = { ...process.env, PORT: port, HOSTNAME: "0.0.0.0" };

console.log(
  `[dev:local] http://localhost:${port} (Docker 3000 과 별개, 소스 즉시 반영)`,
);

const child = spawn(process.execPath, [tsxCli, "server.ts"], {
  stdio: "inherit",
  env,
});

// Ctrl+C 등 종료 신호를 자식(dev 서버)에도 전달한다
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
