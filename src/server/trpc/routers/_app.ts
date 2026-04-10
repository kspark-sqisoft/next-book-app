import { publicProcedure, router } from "@/server/trpc/trpc";

// 클라이언트 `AppRouter` 타입 추론의 루트
export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true as const,
    ts: Date.now(),
  })),
});

export type AppRouter = typeof appRouter;
