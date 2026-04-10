// 전역 대기 UI: hydrate·리다이렉트 직전 등
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  spinnerClassName?: string;
};

export function CenteredSpinner({
  className,
  spinnerClassName = "size-8 text-muted-foreground",
}: Props) {
  return (
    <div
      className={cn("flex min-h-[40vh] items-center justify-center", className)}
    >
      <Spinner className={spinnerClassName} />
    </div>
  );
}
