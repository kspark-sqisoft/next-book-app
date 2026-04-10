import { initTRPC } from "@trpc/server";
import superjson from "superjson";

import type { TRPCContext } from "@/server/trpc/context";

// Date·Map 등 직렬화를 위해 superjson
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure; // 인증 미들웨어는 추후 확장 지점
