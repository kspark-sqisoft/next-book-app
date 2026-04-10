// react-dom useFormStatus: 제출 중 비활성·스피너
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

export type FormStatusSubmitButtonProps = Omit<
  ButtonProps,
  "type" | "disabled" | "children"
> & {
  children: ReactNode;
  /** pending일 때 버튼 안에 보이는 문구 */
  pendingLabel?: ReactNode;
  disabled?: boolean;
  /** pending일 때 스피너 표시 여부 */
  showSpinner?: boolean;
  spinnerClassName?: string;
};

export function FormStatusSubmitButton({
  children,
  pendingLabel = "진행 중…",
  disabled = false,
  className,
  showSpinner = true,
  spinnerClassName,
  variant,
  size,
  ...rest
}: FormStatusSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={disabled || pending}
      className={cn(className)}
      {...rest}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          {showSpinner ? (
            <Spinner className={cn("size-4 shrink-0", spinnerClassName)} />
          ) : null}
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
