import { LayoutTemplate } from "lucide-react";
import { BookSlideTemplatePreview } from "@/components/books/BookSlideTemplatePreview";
import {
  BOOK_SLIDE_TEMPLATE_CATEGORIES,
  bookSlideTemplatesInCategory,
  type BookSlideTemplateId,
} from "@/lib/book-slide-templates";
import { Button } from "@/components/ui/button";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
  bookDockedPanelRootClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";

export function BookSlideTemplatesPanel({
  onApplyTemplate,
  className,
}: {
  onApplyTemplate: (templateId: BookSlideTemplateId) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(bookDockedPanelRootClass(), className)}
      role="region"
      aria-label="슬라이드 템플릿"
    >
      <div className={bookDockedPanelHeaderRowClass()}>
        <LayoutTemplate className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={bookDockedPanelHeadingClass()}>템플릿</span>
      </div>
      <p className="shrink-0 border-b border-border/40 bg-muted/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        디지털 사이니지·메뉴보드·공지 패널용 레이아웃입니다. 유형별로 골라 적용하세요. 미리보기는 배치만
        표시하며, <code className="rounded bg-muted px-1 py-0.5 text-[10px]">public/cards/</code> 샘플 이미지가
        포함될 수 있습니다.
      </p>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-2 [-webkit-overflow-scrolling:touch]">
        {BOOK_SLIDE_TEMPLATE_CATEGORIES.map((cat) => {
          const items = bookSlideTemplatesInCategory(cat.id);
          if (items.length === 0) return null;
          return (
            <section key={cat.id} className="space-y-2" aria-labelledby={`tmpl-cat-${cat.id}`}>
              <header className="px-1">
                <h3 id={`tmpl-cat-${cat.id}`} className="text-xs font-semibold tracking-tight text-foreground">
                  {cat.name}
                </h3>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{cat.description}</p>
              </header>
              <div className="space-y-2">
                {items.map((t) => (
                  <article
                    key={t.id}
                    className={cn(
                      "group rounded-lg border-2 border-border bg-background/90 p-2.5 shadow-sm",
                      "transition-[border-color,box-shadow,ring-color] duration-200 ease-out",
                      "hover:border-primary hover:shadow-md hover:ring-2 hover:ring-primary/40 hover:ring-offset-2 hover:ring-offset-background",
                      "dark:hover:ring-primary/50",
                    )}
                  >
                    <BookSlideTemplatePreview
                      templateId={t.id}
                      className="mb-2 border-2 border-border/70 transition-[border-color] duration-200 group-hover:border-primary/55"
                    />
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.description}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-2 w-full"
                      onClick={() => onApplyTemplate(t.id)}
                    >
                      이 슬라이드에 적용
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
