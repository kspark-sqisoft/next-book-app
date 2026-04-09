import { expect, test } from "vitest";

import { cn } from "@/lib/utils";

test("cn 병합", () => {
  expect(cn("a", false && "b", "c")).toBe("a c");
  expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
});
