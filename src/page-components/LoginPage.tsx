"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useOptimistic,
} from "react";
import { toast } from "sonner";

import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { FormFieldError } from "@/components/forms/FormFieldError";
import { FormStatusSubmitButton } from "@/components/forms/FormStatusSubmitButton";
import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appLog } from "@/lib/app-log";
import { formDataGetString } from "@/lib/form-data-utils";
import { type LoginFormValues, loginSchema } from "@/lib/schemas/forms";
import { cn } from "@/lib/utils";
import { fieldErrorsFromZodIssues } from "@/lib/zod-form";
import { useAuth } from "@/stores/auth-store";

type LoginActionState = {
  serverError: string | null;
  fieldErrors: Partial<Record<keyof LoginFormValues, string>>;
};

/** 로그인 성공 시 `?from=` 또는 기본 `/me`로 이동 */
export function LoginPage() {
  const { user, isReady, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/me";
  const justRegistered = searchParams.get("registered") === "1";

  const initialState: LoginActionState = { serverError: null, fieldErrors: {} };

  async function loginAction(
    _prevState: LoginActionState,
    formData: FormData,
  ): Promise<LoginActionState> {
    const parsed = loginSchema.safeParse({
      email: formDataGetString(formData, "email"),
      password: formDataGetString(formData, "password"),
    });
    if (!parsed.success) {
      return {
        serverError: null,
        fieldErrors: fieldErrorsFromZodIssues<keyof LoginFormValues>(
          parsed.error.issues,
        ),
      };
    }

    try {
      await signIn(parsed.data.email.trim(), parsed.data.password);
      appLog("login", "폼 제출 후 signIn 성공", { redirectTo: from });
      toast.success("로그인되었습니다.");
      return { serverError: null, fieldErrors: {} };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      appLog("login", "폼 제출 실패", msg);
      toast.error(msg);
      return { serverError: msg, fieldErrors: {} };
    }
  }

  const [formState, formAction] = useActionState(loginAction, initialState);
  const [optimisticState, addOptimistic] = useOptimistic(
    formState,
    (current, next: Partial<LoginActionState>) => ({ ...current, ...next }),
  );

  useEffect(() => {
    if (user && isReady) {
      appLog("login", "이미 로그인됨 → 이전 목적지로 이동", { to: from });
      router.replace(from);
    }
  }, [user, isReady, from, router]);

  if (!isReady) {
    return <CenteredSpinner />;
  }

  if (user) {
    return <CenteredSpinner />;
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>로그인</CardTitle>
          <CardDescription>이메일과 비밀번호를 입력하세요.</CardDescription>
        </CardHeader>
        <form
          action={formAction}
          onSubmit={() => {
            startTransition(() => {
              addOptimistic({ serverError: null, fieldErrors: {} });
            });
          }}
          noValidate
        >
          <CardContent className="space-y-4 pb-6">
            {justRegistered ? (
              <Alert>
                <AlertTitle>가입 완료</AlertTitle>
                <AlertDescription>로그인해 주세요.</AlertDescription>
              </Alert>
            ) : null}
            <FormErrorAlert message={optimisticState.serverError} />
            <div className="space-y-2">
              <Label htmlFor="login-email">이메일</Label>
              <Input
                id="login-email"
                name="email"
                autoComplete="email"
                aria-invalid={Boolean(optimisticState.fieldErrors.email)}
                className={cn(
                  optimisticState.fieldErrors.email && "border-destructive",
                )}
              />
              <FormFieldError message={optimisticState.fieldErrors.email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">비밀번호</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(optimisticState.fieldErrors.password)}
                className={cn(
                  optimisticState.fieldErrors.password && "border-destructive",
                )}
              />
              <FormFieldError message={optimisticState.fieldErrors.password} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <FormStatusSubmitButton className="w-full sm:w-auto">
              로그인
            </FormStatusSubmitButton>
            <p className="text-center text-xs text-muted-foreground sm:text-right">
              계정이 없으신가요?{" "}
              <Link
                href="/signup"
                className="text-primary underline-offset-4 hover:underline"
              >
                회원가입
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
