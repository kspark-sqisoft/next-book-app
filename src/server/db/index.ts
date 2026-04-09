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

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

function createClient() {
  const url = `postgresql://${encodeURIComponent(DB_USERNAME)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  const sql = postgres(url, { max: 10 });
  return { sql, db: drizzle(sql, { schema }) };
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
