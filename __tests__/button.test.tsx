import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button } from "@/components/ui/button";

/** React 컴포넌트 단위 테스트 — Next.js Vitest 가이드 패턴 */
test("Button 이 자식 텍스트를 렌더한다", () => {
  render(<Button type="button">Click me</Button>);
  expect(screen.getByRole("button", { name: "Click me" })).toBeDefined();
});
