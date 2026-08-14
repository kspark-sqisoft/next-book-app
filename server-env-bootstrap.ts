// `tsx server.ts`는 Next `prepare()`보다 먼저 `@/server/*` 모듈이 로드된다.
// 그 시점에 `.env`가 없으면 JWT 시크릿이 기본값으로 박혀 소켓 handshake만 계속 실패한다.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
