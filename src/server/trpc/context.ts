import { getDb } from "@/server/db";
import { getBearerPayload } from "@/server/http/request-auth";

// 각 tRPC 요청마다 DB 핸들 + 선택적 사용자
export async function createTRPCContext(opts: { req: Request }) {
  const user = await getBearerPayload(opts.req);
  return { db: getDb(), user };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
