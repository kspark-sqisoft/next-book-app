"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createCatAction,
  deleteCatAction,
  listCatsAction,
  uploadCatImageAction,
} from "@/actions/cats";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { FormFieldError } from "@/components/forms/FormFieldError";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccessToken } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { canEditCatAsOwnerOrAdmin } from "@/lib/authz";
import { formDataGetString } from "@/lib/form-data-utils";
import { formatDateMediumShort } from "@/lib/format-date";
import { catKeys } from "@/lib/query-keys";
import { type CatCreateFormValues, catCreateSchema } from "@/lib/schemas/forms";
import { fieldErrorsFromZodIssues } from "@/lib/zod-form";
import { useAuth } from "@/stores/auth-store";

/** 공부용: 목록 로드 후 상세 경로를 너무 많이 두드리지 않도록 상한만 둡니다. */
const CAT_DETAIL_PREFETCH_CAP = 12;

/**
 * 고양이 목록은 누구나 조회. 등록·삭제·사진 업로드는 로그인 사용자만 (서버 액션에서 JWT 검증).
 */
export function CatsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const listKey = catKeys.list();
  const formRef = useRef<HTMLFormElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<
    Partial<Record<keyof CatCreateFormValues, string>>
  >({});
  const [createServerError, setCreateServerError] = useState<string | null>(
    null,
  );

  const {
    data: cats = [],
    isPending: listPending,
    isError: listError,
    error: listQueryError,
  } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const { cats: items } = await listCatsAction();
      appLog("cats", "목록 로드", { count: items.length });
      return items;
    },
  });

  // 공부용: React Query로 목록을 받은 뒤 App Router `router.prefetch`로 상세 세그먼트를 백그라운드 프리패치합니다.
  useEffect(() => {
    if (cats.length === 0) return;
    const slice = cats.slice(0, CAT_DETAIL_PREFETCH_CAP);
    for (const c of slice) {
      router.prefetch(`/cats/${c.id}`);
    }
    appLog("cats", "공부용 prefetch", { count: slice.length });
  }, [cats, router]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      await deleteCatAction(token, id);
    },
    onSuccess: (_data, deletedId) => {
      toast.success("삭제되었습니다.");
      void queryClient.invalidateQueries({ queryKey: catKeys.all });
      setDeleteTargetId(null);
      appLog("cats", "삭제 완료", { id: deletedId });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      age?: number;
      breed?: string;
      image: File | null;
    }) => {
      const token = getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      const cat = await createCatAction(token, {
        name: input.name,
        ...(input.age !== undefined ? { age: input.age } : {}),
        ...(input.breed !== undefined && input.breed !== ""
          ? { breed: input.breed }
          : {}),
      });
      if (input.image && input.image.size > 0) {
        const fd = new FormData();
        fd.append("image", input.image);
        return uploadCatImageAction(token, cat.id, fd);
      }
      return cat;
    },
    onSuccess: () => {
      toast.success("고양이를 등록했습니다.");
      setCreateFieldErrors({});
      setCreateServerError(null);
      formRef.current?.reset();
      if (imageInputRef.current) imageInputRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: catKeys.all });
      appLog("cats", "등록 성공");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "등록에 실패했습니다.";
      setCreateServerError(msg);
      toast.error(msg);
    },
  });

  function onSubmitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateServerError(null);
    const fd = new FormData(e.currentTarget);
    const parsed = catCreateSchema.safeParse({
      name: formDataGetString(fd, "name"),
      breed: formDataGetString(fd, "breed"),
      age: formDataGetString(fd, "age"),
    });
    if (!parsed.success) {
      setCreateFieldErrors(
        fieldErrorsFromZodIssues<keyof CatCreateFormValues>(
          parsed.error.issues,
        ),
      );
      return;
    }
    setCreateFieldErrors({});
    const file = imageInputRef.current?.files?.[0] ?? null;
    createMutation.mutate({
      name: parsed.data.name,
      ...(parsed.data.age.trim()
        ? { age: Number(parsed.data.age.trim()) }
        : {}),
      ...(parsed.data.breed.trim() ? { breed: parsed.data.breed.trim() } : {}),
      image: file && file.size > 0 ? file : null,
    });
  }

  const listErrMsg =
    listError && listQueryError instanceof Error
      ? listQueryError.message
      : listError
        ? "목록을 불러오지 못했습니다."
        : null;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Cats (학습)
        </h1>
        <p className="text-sm text-muted-foreground">
          목록·상세는 공개입니다. 등록은 로그인 사용자만, 삭제·수정은 해당
          고양이를 등록한 사람 또는 관리자만 할 수 있습니다.
        </p>
      </div>

      {user ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">고양이 등록</CardTitle>
            <CardDescription>
              이름은 필수입니다. 나이·품종은 선택(나이 비우면 서버 기본값 1,
              품종 비우면 mixed). 사진은 선택(JPEG·PNG·GIF·WebP, 최대 3MB) —
              등록 직후 같은 요청 흐름에서 업로드됩니다.
            </CardDescription>
          </CardHeader>
          <form ref={formRef} onSubmit={onSubmitCreate}>
            <CardContent className="space-y-4">
              <FormErrorAlert message={createServerError} />
              <div className="space-y-2">
                <Label htmlFor="cat-name">이름</Label>
                <Input
                  id="cat-name"
                  name="name"
                  autoComplete="off"
                  placeholder="예: 나비"
                  aria-invalid={Boolean(createFieldErrors.name)}
                />
                <FormFieldError message={createFieldErrors.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-age">나이 (0~40, 비워 두면 기본)</Label>
                <Input
                  id="cat-age"
                  name="age"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="예: 3"
                  aria-invalid={Boolean(createFieldErrors.age)}
                />
                <FormFieldError message={createFieldErrors.age} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-breed">품종</Label>
                <Input
                  id="cat-breed"
                  name="breed"
                  autoComplete="off"
                  placeholder="예: 코리안숏헤어"
                  aria-invalid={Boolean(createFieldErrors.breed)}
                />
                <FormFieldError message={createFieldErrors.breed} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-image">사진 (선택)</Label>
                <Input
                  id="cat-image"
                  ref={imageInputRef}
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="cursor-pointer text-sm file:me-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium mb-4"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="size-4 shrink-0" />
                    등록 중…
                  </span>
                ) : (
                  "등록"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">등록하려면 로그인하세요</CardTitle>
            <CardDescription>
              <Button asChild variant="link" className="h-auto p-0">
                <Link href={`/login?from=${encodeURIComponent("/cats")}`}>
                  로그인
                </Link>
              </Button>
              후 이 페이지에서 고양이를 추가할 수 있습니다.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">목록</h2>
        {listErrMsg ? (
          <FormErrorAlert message={listErrMsg} />
        ) : listPending ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-8 text-muted-foreground" />
          </div>
        ) : cats.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            아직 등록된 고양이가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">사진</TableHead>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-16">나이</TableHead>
                  <TableHead>품종</TableHead>
                  <TableHead className="hidden sm:table-cell">등록일</TableHead>
                  <TableHead className="w-32 text-right">동작</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="py-2">
                      <Link
                        href={`/cats/${c.id}`}
                        prefetch
                        className="block size-11 overflow-hidden rounded-md bg-muted ring-1 ring-border"
                        aria-label={`${c.name} 사진`}
                      >
                        {c.imageUrl ? (
                          <SafeImage
                            src={c.imageUrl}
                            alt=""
                            className="size-full object-cover"
                            placeholderLabel={`${c.name} 사진`}
                            fallback={
                              <span className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                                —
                              </span>
                            }
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                            없음
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/cats/${c.id}`}
                        prefetch
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>{c.age}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.breed}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {formatDateMediumShort(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {user &&
                      canEditCatAsOwnerOrAdmin(user, c.ownerId ?? null) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTargetId(c.id)}
                        >
                          삭제
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AlertDialog
        open={deleteTargetId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 고양이를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              번호 {deleteTargetId ?? ""}번 항목이 삭제됩니다. 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending || deleteTargetId == null}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTargetId != null) {
                  deleteMutation.mutate(deleteTargetId);
                }
              }}
            >
              {deleteMutation.isPending ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
