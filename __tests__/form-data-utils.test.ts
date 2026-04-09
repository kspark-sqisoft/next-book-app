import { expect, test } from "vitest";

import { formDataGetString } from "@/lib/form-data-utils";

test("formDataGetString", () => {
  const fd = new FormData();
  fd.set("a", "x");
  expect(formDataGetString(fd, "a")).toBe("x");
  expect(formDataGetString(fd, "missing")).toBe("");
});
