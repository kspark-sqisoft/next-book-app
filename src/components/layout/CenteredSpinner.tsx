import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  spinnerClassName?: string;
};

/** 인증 hydrate·에디터 초기 로드 등 공통 대기 UI */
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
