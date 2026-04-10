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
export * from "./schema";
