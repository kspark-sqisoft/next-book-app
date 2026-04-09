import { getDb } from "@/server/db";
import { getBearerPayload } from "@/server/http/request-auth";

export async function createTRPCContext(opts: { req: Request }) {
  const user = await getBearerPayload(opts.req);
  return { db: getDb(), user };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
