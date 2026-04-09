"use client";

import { startTransition, useActionState, useEffect, useOptimistic } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appLog } from "@/lib/app-log";
import { formDataGetString } from "@/lib/form-data-utils";
import { fieldErrorsFromZodIssues } from "@/lib/zod-form";
import { signupSchema, type SignupFormValues } from "@/lib/schemas/forms";
import { useAuth } from "@/stores/auth-store";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { FormFieldError } from "@/components/forms/FormFieldError";
import { FormStatusSubmitButton } from "@/components/forms/FormStatusSubmitButton";
import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SignupActionState = {
  serverError: string | null;
  fieldErrors: Partial<Record<keyof SignupFormValues, string>>;
  redirectToLogin: boolean;
};

/** 가입 API만 호출 후 로그인 화면으로 보내고, `registered` 플래그로 안내 문구 표시 */
export function SignupPage() {
  const { user, isReady, signUp } = useAuth();
  const router = useRouter();

  const initialState: SignupActionState = {
    serverError: null,
    fieldErrors: {},
    redirectToLogin: false,
  };

  async function signupAction(
    _prevState: SignupActionState,
    formData: FormData,
  ): Promise<SignupActionState> {
    const parsed = signupSchema.safeParse({
      name: formDataGetString(formData, "name"),
      email: formDataGetString(formData, "email"),
      password: formDataGetString(formData, "password"),
    });
    if (!parsed.success) {
      return {
        serverError: null,
        fieldErrors: fieldErrorsFromZodIssues<keyof SignupFormValues>(parsed.error.issues),
        redirectToLogin: false,
      };
    }

    try {
      await signUp({
        email: parsed.data.email.trim(),
        password: parsed.data.password,
        name: parsed.data.name.trim(),
      });
      appLog("signup", "가입 완료 → 로그인 화면 이동");
      toast.success("회원가입이 완료되었습니다. 로그인해 주세요.");
      return { serverError: null, fieldErrors: {}, redirectToLogin: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "회원가입에 실패했습니다.";
      appLog("signup", "가입 실패", msg);
      toast.error(msg);
      return { serverError: msg, fieldErrors: {}, redirectToLogin: false };
    }
  }

  const [formState, formAction] = useActionState(signupAction, initialState);
  const [optimisticState, addOptimistic] = useOptimistic(
    formState,
    (current, next: Partial<SignupActionState>) => ({ ...current, ...next }),
  );

  useEffect(() => {
    if (!optimisticState.redirectToLogin) return;
    router.replace("/login?registered=1");
  }, [optimisticState.redirectToLogin, router]);

  useEffect(() => {
    if (user && isReady) router.replace("/me");
  }, [user, isReady, router]);

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
          <CardTitle>회원가입</CardTitle>
          <CardDescription>새 계정을 만듭니다.</CardDescription>
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
            <FormErrorAlert message={optimisticState.serverError} />
            <div className="space-y-2">
              <Label htmlFor="signup-name">이름</Label>
              <Input
                id="signup-name"
                name="name"
                autoComplete="name"
                aria-invalid={Boolean(optimisticState.fieldErrors.name)}
                className={cn(optimisticState.fieldErrors.name && "border-destructive")}
              />
              <FormFieldError message={optimisticState.fieldErrors.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">이메일</Label>
              <Input
                id="signup-email"
                name="email"
                autoComplete="email"
                aria-invalid={Boolean(optimisticState.fieldErrors.email)}
                className={cn(optimisticState.fieldErrors.email && "border-destructive")}
              />
              <FormFieldError message={optimisticState.fieldErrors.email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">비밀번호</Label>
              <Input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(optimisticState.fieldErrors.password)}
                className={cn(optimisticState.fieldErrors.password && "border-destructive")}
              />
              <FormFieldError message={optimisticState.fieldErrors.password} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <FormStatusSubmitButton className="w-full sm:w-auto">가입하기</FormStatusSubmitButton>
            <p className="text-center text-xs text-muted-foreground sm:text-right">
              이미 계정이 있나요?{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                로그인
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
