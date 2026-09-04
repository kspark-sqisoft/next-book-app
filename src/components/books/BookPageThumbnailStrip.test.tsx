// 모바일 하단 썸네일 스트립 — 탭하면 그 페이지로, 현재 페이지는 aria-current
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookPageThumbnailStrip } from "@/components/books/BookPageThumbnailStrip";

afterEach(() => cleanup());

describe("BookPageThumbnailStrip", () => {
  it("썸네일을 탭하면 그 인덱스로 이동하고 현재 페이지가 표시된다", () => {
    const onSelectPage = vi.fn();
    const { getAllByRole } = render(
      <BookPageThumbnailStrip
        pageCount={4}
        pageKeys={["a", "b", "c", "d"]}
        thumbnailsByKey={{ a: "data:image/png;base64,x" }}
        activeIndex={1}
        pageLabels={["표지", "", "셋", "넷"]}
        onSelectPage={onSelectPage}
        slideWidth={1920}
        slideHeight={1080}
      />,
    );
    const items = getAllByRole("tab");
    expect(items).toHaveLength(4);
    expect(items[1].getAttribute("aria-selected")).toBe("true");
    expect(items[0].getAttribute("aria-selected")).toBe("false");
    expect(items[0].textContent).toContain("표지");
    expect(items[1].textContent).toContain("슬라이드 2");
    fireEvent.click(items[3]);
    expect(onSelectPage).toHaveBeenCalledWith(3);
  });

  it("페이지가 1장이면 렌더하지 않는다", () => {
    const { container } = render(
      <BookPageThumbnailStrip
        pageCount={1}
        activeIndex={0}
        onSelectPage={() => undefined}
        slideWidth={1920}
        slideHeight={1080}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
