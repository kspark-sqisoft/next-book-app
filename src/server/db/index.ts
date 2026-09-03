// NOTE: 여기에는 `server-only` 를 붙이지 않는다.
// 커스텀 서버(`server.ts` + socket.io)가 Next 의 react-server 레이어 **밖에서** 이 모듈을
// 직접 import 하는데, `server-only` 는 그 조건에서 해석되면 즉시 throw 한다(기동 실패).
// 보호는 이 위층인 `server/services/*` 가 맡는다 — 서비스에는 표시가 붙어 있고,
// 이 파일은 pg·drizzle 같은 노드 전용 의존을 써서 클라이언트 번들에 들어가면 어차피 깨진다.
// Drizzle + postgres-js 드라이버
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_USERNAME,
} from "@/server/env";

import * as schema from "./schema";

// 핫 리로드 시 연결 폭주 방지: 글로벌에 단일 풀 유지
const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

function createClient() {
  const url = `postgresql://${encodeURIComponent(DB_USERNAME)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  const sql = postgres(url, { max: 10 }); // 풀 크기 상한
  return { sql, db: drizzle(sql, { schema }) }; // 스키마 등록으로 relational query API 사용
}

export function getDb() {
  if (!globalForDb.db) {
    const { sql, db } = createClient();
    globalForDb.sql = sql;
    globalForDb.db = db;
  }
  return globalForDb.db!;
}

export type Db = ReturnType<typeof getDb>;
/**
 * `db` 본체 또는 트랜잭션 핸들. 여러 테이블에 걸친 정리를 호출자의 트랜잭션에
 * 합류시킬 때 쓴다 — 서비스가 각자 `this.db()`를 잡으면 원자성이 깨지고,
 * 이미 트랜잭션이 열린 상태라면 풀에서 커넥션을 하나 더 물어 교착이 날 수 있다.
 */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
export * from "./schema";
