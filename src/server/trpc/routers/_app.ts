import { publicProcedure, router } from "@/server/trpc/trpc";

export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true as const,
    ts: Date.now(),
  })),
});

export type AppRouter = typeof appRouter;
