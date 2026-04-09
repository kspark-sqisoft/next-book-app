import { expect, test } from "vitest";

import type { TRPCContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/routers/_app";

test("tRPC health query", async () => {
  const ctx = {
    user: null,
    db: null as unknown as TRPCContext["db"],
  };
  const caller = appRouter.createCaller(ctx);
  const out = await caller.health();
  expect(out.ok).toBe(true);
  expect(typeof out.ts).toBe("number");
});
