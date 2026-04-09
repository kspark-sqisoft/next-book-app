"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  deleteCatAction,
  getCatAction,
  updateCatAction,
  uploadCatImageAction,
} from "@/actions/cats";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { FormFieldError } from "@/components/forms/FormFieldError";
import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";
import type { Cat } from "@/lib/api";
import { getAccessToken } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { canEditCatAsOwnerOrAdmin } from "@/lib/authz";
import { formatDateFullShort } from "@/lib/format-date";
import { catKeys } from "@/lib/query-keys";
import { type CatCreateFormValues, catCreateSchema } from "@/lib/schemas/forms";
import { fieldErrorsFromZodIssues } from "@/lib/zod-form";
import { useAuth } from "@/stores/auth-store";

/**
 * 서버에서 cat이 바뀔 때마다 `key`로 리마운트되어 폼 초기값이 맞춰짐 (effect 동기화 불필요).
 */
function CatDetailEditor({ cat, id }: { cat: Cat; id: number }) {
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(cat.name);
  const [editAge, setEditAge] = useState(String(cat.age));
  const [editBreed, setEditBreed] = useState(cat.breed);
  const [editFieldErrors, setEditFieldErrors] = useState<
    Partial<Record<keyof CatCreateFormValues, string>>
  >({});
  const [editServerError, setEditServerError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (body: { name: string; age: number; breed: string }) => {
      const token = getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      return updateCatAction(token, id, body);
    },
    onSuccess: () => {
      toast.success("정보를 저장했습니다.");
      setEditServerError(null);
      void queryClient.invalidateQueries({ queryKey: catKeys.all });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "저장에 실패했습니다.";
      setEditServerError(msg);
      toast.error(msg);
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      const fd = new FormData();
      fd.append("image", file);
      return uploadCatImageAction(token, id, fd);
    },
    onSuccess: () => {
      toast.success("사진을 올렸습니다.");
      void queryClient.invalidateQueries({ queryKey: catKeys.all });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    },
  });

  function handleSaveProfile() {
    setEditServerError(null);
    const parsed = catCreateSchema.safeParse({
      name: editName,
      breed: editBreed,
      age: editAge,
    });
    if (!parsed.success) {
      setEditFieldErrors(
        fieldErrorsFromZodIssues<keyof CatCreateFormValues>(
          parsed.error.issues,
        ),
      );
      return;
    }
    setEditFieldErrors({});
    const ageStr = parsed.data.age.trim();
    const ageNum = ageStr ? Number(ageStr) : cat.age;
    updateMutation.mutate({
      name: parsed.data.name,
      age: ageNum,
      breed: parsed.data.breed.trim() || "mixed",
    });
  }

  return (
    <div className="space-y-4 border-b border-border px-6 py-5">
      <h2 className="font-heading text-lg font-semibold">정보 수정</h2>
      <FormErrorAlert message={editServerError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cat-detail-name">이름</Label>
          <Input
            id="cat-detail-name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(editFieldErrors.name)}
          />
          <FormFieldError message={editFieldErrors.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-detail-age">나이 (0~40)</Label>
          <Input
            id="cat-detail-age"
            value={editAge}
            onChange={(e) => setEditAge(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={Boolean(editFieldErrors.age)}
          />
          <FormFieldError message={editFieldErrors.age} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-detail-breed">품종</Label>
          <Input
            id="cat-detail-breed"
            value={editBreed}
            onChange={(e) => setEditBreed(e.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(editFieldErrors.breed)}
          />
          <FormFieldError message={editFieldErrors.breed} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={updateMutation.isPending}
          onClick={() => void handleSaveProfile()}
        >
          {updateMutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4 shrink-0" />
              저장 중…
            </span>
          ) : (
            "저장"
          )}
        </Button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f && f.size > 0) uploadImageMutation.mutate(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadImageMutation.isPending}
          onClick={() => imageInputRef.current?.click()}
        >
          {uploadImageMutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-3.5 shrink-0" />
              업로드 중…
            </span>
          ) : cat.imageUrl ? (
            "사진 바꾸기"
          ) : (
            "사진 올리기"
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          사진: JPEG·PNG·GIF·WebP, 최대 3MB
        </span>
      </div>
    </div>
  );
}

/** 공개 상세. 로그인 시 삭제·사진·정보 수정 가능. */
export function CatDetailPage() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : NaN;
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    data: cat,
    isPending,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: catKeys.detail(id),
    queryFn: async () => {
      const c = await getCatAction(id);
      appLog("cats", "상세 로드", { id: c.id });
      return c;
    },
    enabled: Number.isFinite(id),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      await deleteCatAction(token, id);
    },
    onSuccess: () => {
      toast.success("삭제되었습니다.");
      void queryClient.invalidateQueries({ queryKey: catKeys.all });
      setDeleteOpen(false);
      router.replace("/cats");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    },
  });

  useEffect(() => {
    if (!Number.isFinite(id) || !isError) return;
    const msg =
      queryError instanceof Error ? queryError.message : "불러오지 못했습니다.";
    toast.error(msg);
  }, [id, isError, queryError]);

  // 공부용: 상세 페이지에 있을 때 목록 `/cats`를 `router.prefetch`로 미리 당겨 옵니다.
  useEffect(() => {
    if (!Number.isFinite(id)) return;
    router.prefetch("/cats");
    appLog("cats", "공부용 prefetch 목록", { id });
  }, [id, router]);

  if (!Number.isFinite(id)) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message="잘못된 번호입니다." />
        <Button asChild variant="outline" size="sm">
          <Link href="/cats" prefetch>
            목록으로
          </Link>
        </Button>
      </div>
    );
  }

  if (isPending) {
    return <CenteredSpinner />;
  }

  const loadError =
    isError && queryError instanceof Error
      ? queryError.message
      : isError
        ? "불러오지 못했습니다."
        : null;

  if (loadError || !cat) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message={loadError ?? "데이터가 없습니다."} />
        <Button asChild variant="outline" size="sm">
          <Link href="/cats" prefetch>
            목록으로
          </Link>
        </Button>
      </div>
    );
  }

  const canMutateCat = canEditCatAsOwnerOrAdmin(user, cat.ownerId ?? null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/cats" prefetch>
            ← 목록
          </Link>
        </Button>
        {user && canMutateCat ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            삭제
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <div className="relative flex min-h-[min(78vh,40rem)] w-full items-center justify-center bg-muted p-4 sm:min-h-[min(82vh,44rem)] sm:p-8">
          {cat.imageUrl ? (
            <SafeImage
              src={cat.imageUrl}
              alt={`${cat.name} 사진`}
              className="max-h-[min(76vh,42rem)] w-full object-contain"
              placeholderLabel={`${cat.name} 사진`}
            />
          ) : (
            <div className="flex min-h-[12rem] w-full items-center justify-center text-sm text-muted-foreground">
              등록된 사진이 없습니다.
            </div>
          )}
        </div>

        {user && canMutateCat ? (
          <CatDetailEditor
            key={`${cat.id}-${cat.updatedAt}`}
            cat={cat}
            id={id}
          />
        ) : (
          <CardHeader>
            <CardTitle className="text-2xl">{cat.name}</CardTitle>
            <CardDescription>
              ID {cat.id} · 나이 {cat.age} · 품종 {cat.breed}
            </CardDescription>
          </CardHeader>
        )}

        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>등록: {formatDateFullShort(cat.createdAt)}</p>
          <p>수정: {formatDateFullShort(cat.updatedAt)}</p>
        </CardContent>
      </Card>

      {!user ? (
        <p className="text-sm text-muted-foreground">
          수정·삭제·사진 업로드는{" "}
          <Button asChild variant="link" className="h-auto p-0">
            <Link href={`/login?from=${encodeURIComponent(`/cats/${id}`)}`}>
              로그인
            </Link>
          </Button>
          후, 등록자 또는 관리자만 이용할 수 있습니다.
        </p>
      ) : !canMutateCat ? (
        <p className="text-sm text-muted-foreground">
          이 고양이 정보를 수정·삭제할 권한이 없습니다. (등록자 또는 관리자만
          가능)
        </p>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{cat.name}」을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
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
