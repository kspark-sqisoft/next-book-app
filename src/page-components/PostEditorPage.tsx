"use client";

// 글 에디터: /posts/new·/posts/:id/edit 공통, 첨부·동영상 포스터·PostRichEditor, useActionState 저장
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { FormFieldError } from "@/components/forms/FormFieldError";
import { FormStatusSubmitButton } from "@/components/forms/FormStatusSubmitButton";
import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
import { PostRichEditor } from "@/components/posts/PostRichEditor";
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
import { createPost, fetchPost, updatePost } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { canEditAsOwnerOrAdmin } from "@/lib/authz";
import { formDataGetString } from "@/lib/form-data-utils";
import { placeholderPosterFile } from "@/lib/placeholder-poster";
import {
  isPostCategoryId,
  POST_CATEGORY_LABELS,
  POST_CATEGORY_VALUES,
  type PostCategoryId,
} from "@/lib/post-categories";
import { postKeys } from "@/lib/query-keys";
import {
  type PostEditorFormValues,
  postEditorSchema,
} from "@/lib/schemas/forms";
import { cn } from "@/lib/utils";
import { captureVideoPosterJpeg } from "@/lib/video-poster";
import { fieldErrorsFromZodIssues } from "@/lib/zod-form";
import { useAuth } from "@/stores/auth-store";

const MAX_ATTACHMENTS = 20;

function fileAttachmentKind(f: File): "image" | "video" | null {
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("video/")) return "video";
  const n = f.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp)$/i.test(n)) return "image";
  if (/\.(mp4|webm|mov)$/i.test(n)) return "video";
  return null;
}

type EditorSlot =
  | {
      key: string;
      type: "existing";
      id: number;
      kind: "image" | "video";
      url: string;
      posterUrl: string | null;
    }
  | {
      key: string;
      type: "new";
      kind: "image" | "video";
      file: File;
      /** 동영상만 업로드 시 사용; 이미지는 자리 맞춤용(미사용) */
      posterFile: File;
      previewUrl: string;
      /** 동영상 썸네일 미리보기( revoke 용 ) */
      posterObjectUrl?: string;
    };

type PostEditorActionState = {
  serverError: string | null;
  fieldErrors: Partial<Record<keyof PostEditorFormValues, string>>;
  redirectTo: string | null;
};

export function PostEditorPage() {
  const { id: idParam } = useParams();
  const isEdit = idParam !== undefined;
  const postId = idParam ? Number(idParam) : NaN;

  const { user, isReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const viewerKey = user?.sub ?? "anon";

  const [slots, setSlots] = useState<EditorSlot[]>([]);
  const slotsRef = useRef<EditorSlot[]>([]);
  slotsRef.current = slots;

  const hydratedPostId = useRef<number | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PostCategoryId>("general");

  const initialState: PostEditorActionState = {
    serverError: null,
    fieldErrors: {},
    redirectTo: null,
  };

  async function postEditorAction(
    _prevState: PostEditorActionState,
    formData: FormData,
  ): Promise<PostEditorActionState> {
    const parsed = postEditorSchema.safeParse({
      title: formDataGetString(formData, "title"),
      content: formDataGetString(formData, "content"),
      category: formDataGetString(formData, "category") || "general",
    });
    if (!parsed.success) {
      return {
        serverError: null,
        fieldErrors: fieldErrorsFromZodIssues<keyof PostEditorFormValues>(
          parsed.error.issues,
        ),
        redirectTo: null,
      };
    }

    const currentSlots = slotsRef.current;

    try {
      if (isEdit) {
        if (currentSlots.length === 0) {
          const updated = await updatePost(postId, {
            title: parsed.data.title.trim(),
            content: parsed.data.content,
            category: parsed.data.category,
            mediaPlan: [],
          });
          queryClient.setQueryData(
            postKeys.detail(updated.id, viewerKey),
            updated,
          );
          void queryClient.invalidateQueries({ queryKey: postKeys.lists() });
          appLog("posts", "글 수정 저장", { id: updated.id });
          toast.success("글이 수정되었습니다.");
          return {
            serverError: null,
            fieldErrors: {},
            redirectTo: `/posts/${updated.id}`,
          };
        }

        const mediaPlan: Array<{ t: "e"; id: number } | { t: "n"; i: number }> =
          [];
        const newFiles: File[] = [];
        const newPosters: File[] = [];
        for (const s of currentSlots) {
          if (s.type === "existing") {
            mediaPlan.push({ t: "e", id: s.id });
          } else {
            mediaPlan.push({ t: "n", i: newFiles.length });
            newFiles.push(s.file);
            if (s.kind === "video") newPosters.push(s.posterFile);
          }
        }

        const updated = await updatePost(postId, {
          title: parsed.data.title.trim(),
          content: parsed.data.content,
          category: parsed.data.category,
          mediaPlan,
          newFiles,
          newPosters,
        });
        queryClient.setQueryData(
          postKeys.detail(updated.id, viewerKey),
          updated,
        );
        void queryClient.invalidateQueries({ queryKey: postKeys.lists() });
        appLog("posts", "글 수정 저장", { id: updated.id });
        toast.success("글이 수정되었습니다.");
        return {
          serverError: null,
          fieldErrors: {},
          redirectTo: `/posts/${updated.id}`,
        };
      }

      const attachmentFiles: File[] = [];
      const posterFiles: File[] = [];
      for (const s of currentSlots) {
        if (s.type !== "new") continue;
        attachmentFiles.push(s.file);
      }
      for (const s of currentSlots) {
        if (s.type === "new" && s.kind === "video") {
          posterFiles.push(s.posterFile);
        }
      }

      const created = await createPost({
        title: parsed.data.title.trim(),
        content: parsed.data.content,
        category: parsed.data.category,
        attachmentFiles,
        posterFiles,
      });
      void queryClient.invalidateQueries({ queryKey: postKeys.all });
      appLog("posts", "글 작성 저장", { id: created.id });
      toast.success("글이 등록되었습니다.");
      return {
        serverError: null,
        fieldErrors: {},
        redirectTo: `/posts/${created.id}`,
      };
    } catch (err) {
      appLog("posts", "저장 실패", err instanceof Error ? err.message : err);
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다.";
      toast.error(msg);
      return {
        serverError: msg,
        fieldErrors: {},
        redirectTo: null,
      };
    }
  }

  const [formState, formAction] = useActionState(
    postEditorAction,
    initialState,
  );
  const [optimisticState, addOptimistic] = useOptimistic(
    formState,
    (current, next: Partial<PostEditorActionState>) => ({
      ...current,
      ...next,
    }),
  );

  useEffect(() => {
    if (!optimisticState.redirectTo) return;
    router.replace(optimisticState.redirectTo);
  }, [optimisticState.redirectTo, router]);

  useEffect(() => {
    if (!isReady || user) return;
    router.replace(`/login?from=${encodeURIComponent(pathname)}`);
  }, [isReady, user, router, pathname]);

  useEffect(() => {
    if (forbidden) router.replace(`/posts/${postId}`);
  }, [forbidden, postId, router]);

  useEffect(() => {
    if (isEdit && !Number.isFinite(postId)) router.replace("/posts");
  }, [isEdit, postId, router]);

  useEffect(() => {
    hydratedPostId.current = null;
  }, [postId]);

  const {
    data: loadedPost,
    isPending: postLoading,
    isError,
    error: postQueryError,
  } = useQuery({
    queryKey: postKeys.detail(postId, viewerKey),
    queryFn: async () => {
      const post = await fetchPost(postId);
      appLog("posts", "에디터 기존 글 로드", { postId });
      return post;
    },
    enabled: isEdit && Number.isFinite(postId),
  });

  useEffect(() => {
    if (!isEdit || !Number.isFinite(postId) || !isError) return;
    const msg =
      postQueryError instanceof Error
        ? postQueryError.message
        : "글을 불러오지 못했습니다.";
    toast.error(msg);
  }, [isEdit, postId, isError, postQueryError]);

  const loadError =
    isEdit && isError
      ? postQueryError instanceof Error
        ? postQueryError.message
        : "글을 불러오지 못했습니다."
      : null;

  useEffect(() => {
    startTransition(() => {
      if (!isEdit || !Number.isFinite(postId)) {
        setTitle("");
        setCategory("general");
        setSlots([]);
        setForbidden(false);
        return;
      }
      if (postLoading || !loadedPost) return;
      if (user && !canEditAsOwnerOrAdmin(user, loadedPost.author.id)) {
        appLog("posts", "수정 권한 없음 — 상세로 이동", { postId });
        setForbidden(true);
        return;
      }
      setForbidden(false);
      setTitle(loadedPost.title);
      setCategory(
        isPostCategoryId(loadedPost.category) ? loadedPost.category : "general",
      );
    });
  }, [isEdit, postId, loadedPost, postLoading, user]);

  useEffect(() => {
    if (!isEdit || postLoading || !loadedPost) return;
    if (hydratedPostId.current === loadedPost.id) return;
    hydratedPostId.current = loadedPost.id;
    setSlots(
      (loadedPost.media ?? []).map((m) => ({
        key: `e-${m.id}`,
        type: "existing" as const,
        id: m.id,
        kind: m.kind,
        url: m.url,
        posterUrl: m.posterUrl,
      })),
    );
  }, [isEdit, postLoading, loadedPost]);

  async function onPickFiles(list: FileList | null) {
    if (!list?.length) return;
    setAddBusy(true);
    try {
      const additions: EditorSlot[] = [];
      for (let i = 0; i < list.length; i++) {
        if (slotsRef.current.length + additions.length >= MAX_ATTACHMENTS) {
          toast.error(`첨부는 최대 ${MAX_ATTACHMENTS}개까지입니다.`);
          break;
        }
        const f = list[i];
        const kind = fileAttachmentKind(f);
        if (!kind) {
          toast.error(
            "JPEG, PNG, GIF, WebP 또는 MP4, WebM, MOV만 추가할 수 있습니다.",
          );
          continue;
        }
        if (kind === "image") {
          additions.push({
            key: `n-${crypto.randomUUID()}`,
            type: "new",
            kind: "image",
            file: f,
            posterFile: placeholderPosterFile(),
            previewUrl: URL.createObjectURL(f),
          });
        } else {
          const poster =
            (await captureVideoPosterJpeg(f)) ?? placeholderPosterFile();
          additions.push({
            key: `n-${crypto.randomUUID()}`,
            type: "new",
            kind: "video",
            file: f,
            posterFile: poster,
            previewUrl: URL.createObjectURL(f),
            posterObjectUrl: URL.createObjectURL(poster),
          });
        }
      }
      if (additions.length) {
        setSlots((prev) => [...prev, ...additions].slice(0, MAX_ATTACHMENTS));
      }
    } finally {
      setAddBusy(false);
      const input = document.getElementById(
        "post-attachments",
      ) as HTMLInputElement | null;
      if (input) input.value = "";
    }
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const s = prev[index];
      if (s?.type === "new") {
        URL.revokeObjectURL(s.previewUrl);
        if (s.posterObjectUrl) URL.revokeObjectURL(s.posterObjectUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function moveSlot(index: number, dir: -1 | 1) {
    setSlots((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const cp = [...prev];
      [cp[index], cp[j]] = [cp[j], cp[index]];
      return cp;
    });
  }

  if (!isReady) {
    return <CenteredSpinner />;
  }

  if (!user) {
    return <CenteredSpinner />;
  }

  if (forbidden) {
    return <CenteredSpinner />;
  }

  if (isEdit && !Number.isFinite(postId)) {
    return <CenteredSpinner />;
  }

  if (isEdit && postLoading) {
    return <CenteredSpinner className="min-h-0 py-16" />;
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message={loadError} />
        <Button asChild variant="outline" size="sm">
          <Link href="/posts">목록으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {isEdit ? "글 수정" : "글 작성"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          제목·본문·첨부 미디어를 최대 {MAX_ATTACHMENTS}개까지 넣을 수 있습니다.
          순서는 위아래 버튼으로 바꿀 수 있고, 글 보기에서는 스와이프로
          넘깁니다. 목록에는 첫 첨부가 썸네일로 쓰입니다.
        </p>
      </div>

      <Card>
        <form
          action={formAction}
          onSubmit={() => {
            startTransition(() => {
              addOptimistic({ serverError: null, fieldErrors: {} });
            });
          }}
          noValidate
        >
          <CardHeader>
            <CardTitle>내용</CardTitle>
            <CardDescription>저장 시 즉시 반영됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-6">
            <FormErrorAlert message={optimisticState.serverError} />
            <div className="space-y-2">
              <Label htmlFor="post-category">카테고리</Label>
              <select
                id="post-category"
                name="category"
                value={category}
                onChange={(e) =>
                  setCategory((e.target.value as PostCategoryId) || "general")
                }
                aria-invalid={Boolean(optimisticState.fieldErrors.category)}
                className={cn(
                  "flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  optimisticState.fieldErrors.category && "border-destructive",
                )}
              >
                {POST_CATEGORY_VALUES.map((id) => (
                  <option key={id} value={id}>
                    {POST_CATEGORY_LABELS[id]}
                  </option>
                ))}
              </select>
              <FormFieldError message={optimisticState.fieldErrors.category} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-title">제목</Label>
              <Input
                id="post-title"
                name="title"
                maxLength={200}
                aria-invalid={Boolean(optimisticState.fieldErrors.title)}
                className={cn(
                  optimisticState.fieldErrors.title && "border-destructive",
                )}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <FormFieldError message={optimisticState.fieldErrors.title} />
            </div>
            <div className="space-y-2">
              <Label>본문</Label>
              <PostRichEditor
                key={
                  isEdit && Number.isFinite(postId) ? `edit-${postId}` : "new"
                }
                initialHtml={isEdit && loadedPost ? loadedPost.content : ""}
                invalid={Boolean(optimisticState.fieldErrors.content)}
              />
              <FormFieldError message={optimisticState.fieldErrors.content} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-attachments">
                첨부 미디어 (선택, 여러 개)
              </Label>
              <Input
                id="post-attachments"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                className="cursor-pointer text-sm"
                disabled={addBusy}
                onChange={(e) => void onPickFiles(e.target.files)}
              />
              {addBusy ? (
                <p className="text-xs text-muted-foreground">
                  파일을 처리하는 중…
                </p>
              ) : null}
              {slots.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {slots.map((s, index) => (
                    <li
                      key={s.key}
                      className="flex gap-2 rounded-lg border border-border bg-muted/20 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        {s.type === "existing" ? (
                          s.kind === "image" ? (
                            <SafeImage
                              src={s.url}
                              alt=""
                              className="max-h-36 w-full object-contain"
                              placeholderLabel={`첨부 ${index + 1}`}
                            />
                          ) : (
                            <video
                              src={s.url}
                              controls
                              playsInline
                              className="max-h-36 w-full object-contain"
                              poster={s.posterUrl ?? undefined}
                            />
                          )
                        ) : s.kind === "image" ? (
                          <SafeImage
                            src={s.previewUrl}
                            alt=""
                            className="max-h-36 w-full object-contain"
                            placeholderLabel={`새 이미지 ${index + 1}`}
                          />
                        ) : (
                          <video
                            src={s.previewUrl}
                            controls
                            playsInline
                            className="max-h-36 w-full object-contain"
                            poster={s.posterObjectUrl}
                          />
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {index + 1}번 ·{" "}
                          {s.kind === "image" ? "이미지" : "동영상"}
                          {s.type === "new" ? " (새 파일)" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label="위로"
                          disabled={index === 0}
                          onClick={() => moveSlot(index, -1)}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label="아래로"
                          disabled={index === slots.length - 1}
                          onClick={() => moveSlot(index, 1)}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="size-8 text-destructive"
                          aria-label="이 첨부 제거"
                          onClick={() => removeSlot(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  첨부가 없습니다.
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/30">
            <FormStatusSubmitButton pendingLabel="저장 중…">
              저장
            </FormStatusSubmitButton>
            <Button type="button" variant="outline" asChild>
              <Link href={isEdit ? `/posts/${postId}` : "/posts"}>취소</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
