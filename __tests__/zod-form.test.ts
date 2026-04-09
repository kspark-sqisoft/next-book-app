import { expect, test } from "vitest";
import { z } from "zod";

import { fieldErrorsFromZodIssues } from "@/lib/zod-form";

test("fieldErrorsFromZodIssues 첫 경로 세그먼트만 키로", () => {
  const r = z.object({ email: z.string().email() }).safeParse({ email: "bad" });
  expect(r.success).toBe(false);
  if (r.success) return;
  const m = fieldErrorsFromZodIssues<"email">(r.error.issues);
  expect(m.email).toBeDefined();
});
