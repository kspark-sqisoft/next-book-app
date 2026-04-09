"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { useAuth } from "@/stores/auth-store";
import { appLog } from "@/lib/app-log";
import { isAdminUser } from "@/lib/authz";
import {
  adminSetUserRoleByEmail,
  fetchAdminUsersList,
  fetchMe,
  publicAssetUrl,
  updateMyProfile,
} from "@/lib/api";
import { userKeys } from "@/lib/query-keys";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";

const DISPLAY_NAME_MAX = 100;

/** 로그인 사용자 프로필; 표시 이름·프로필 이미지 */
export function MyInfoPage() {
  const { user, applyServerUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputId = useId();
  const nameInputId = useId();
  const [nameDraft, setNameDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState<"user" | "admin">("user");
  /** 다른 사용자 행 역할 선택값(서버값과 다를 때만 저장 버튼 활성) */
  const [otherRolesDraft, setOtherRolesDraft] = useState<
    Record<number, "user" | "admin">
  >({});
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const blobUrlRef = useRef<string | null>(null);

  const {
    data: me,
    isError: meQueryFailed,
    error: meQueryError,
  } = useQuery({
    queryKey: userKeys.me(),
    queryFn: async () => {
      const u = await fetchMe();
      if (!u) throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
      return u;
    },
    enabled: Boolean(user),
    initialData: user ?? undefined,
    /* 세션 만료 시 fetchMe가 같은 401 경로를 두 번 타며 콘솔에 401이 중복 표시되는 것을 막음 */
    retry: false,
  });

  const profile = me ?? user;

  const isAdmin = Boolean(profile && isAdminUser(profile));

  const {
    data: adminUsersList,
    isLoading: adminUsersLoading,
    isError: adminUsersFailed,
    error: adminUsersError,
    refetch: refetchAdminUsers,
  } = useQuery({
    queryKey: userKeys.adminList(),
    queryFn: fetchAdminUsersList,
    enabled: Boolean(user) && isAdmin,
  });

  const otherUsers = useMemo(() => {
    const selfId = profile?.sub;
    if (selfId == null || !adminUsersList?.length) return [];
    return adminUsersList.filter((u) => u.id !== selfId);
  }, [adminUsersList, profile?.sub]);

  useEffect(() => {
    if (profile?.name != null) {
      startTransition(() => setNameDraft(profile.name));
    }
  }, [profile?.name, profile?.sub]);

  useEffect(() => {
    const r = profile?.role === "admin" ? "admin" : "user";
    startTransition(() => setRoleDraft(r));
  }, [profile?.sub, profile?.role]);

  function releaseLocalPreview() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPickedFile(null);
  }

  const updateProfile = useMutation({
    mutationFn: (input: {
      name?: string;
      image?: File;
      removeImage?: boolean;
    }) => updateMyProfile(input),
    onSuccess: (next, variables) => {
      queryClient.setQueryData(userKeys.me(), next);
      applyServerUser(next);
      if (variables.image != null || variables.removeImage) {
        releaseLocalPreview();
        setFileKey((k) => k + 1);
      }
      appLog("me", "프로필 반영 완료", { sub: next.sub });
      if (variables.name != null) toast.success("표시 이름을 저장했습니다.");
      else if (variables.image != null) toast.success("프로필 이미지를 저장했습니다.");
      else if (variables.removeImage) toast.success("프로필 이미지를 제거했습니다.");
    },
    onError: (e) => {
      const msg =
        e instanceof Error ? e.message : "프로필을 저장하지 못했습니다.";
      toast.error(msg);
    },
  });

  const updateRole = useMutation({
    mutationFn: (next: "user" | "admin") => updateMyProfile({ role: next }),
    onSuccess: (next) => {
      queryClient.setQueryData(userKeys.me(), next);
      applyServerUser(next);
      appLog("me", "역할 반영 완료", { sub: next.sub, role: next.role });
      toast.success("계정 유형을 저장했습니다.");
    },
    onError: (e) => {
      const msg =
        e instanceof Error ? e.message : "역할을 저장하지 못했습니다.";
      toast.error(msg);
    },
  });

  const adminSetOtherRole = useMutation({
    mutationFn: (input: {
      userId: number;
      email: string;
      role: "user" | "admin";
    }) => adminSetUserRoleByEmail({ email: input.email, role: input.role }),
    onSuccess: (row, vars) => {
      adminSetOtherRole.reset();
      setOtherRolesDraft((prev) => {
        const next = { ...prev };
        delete next[vars.userId];
        return next;
      });
      appLog("me", "관리자 역할 지정 완료", {
        targetId: row.id,
        role: row.role,
      });
      toast.success(`저장했습니다: ${row.email} → ${row.role === "admin" ? "관리자" : "일반"}`);
      void queryClient.invalidateQueries({ queryKey: userKeys.adminList() });
      void queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
    onError: (e) => {
      const msg =
        e instanceof Error ? e.message : "역할을 지정하지 못했습니다.";
      toast.error(msg);
    },
  });

  useEffect(() => {
    appLog("me", "내 정보 화면", profile ? { sub: profile.sub } : {});
  }, [profile]);

  useEffect(() => {
    if (!meQueryFailed) return;
    const msg =
      meQueryError instanceof Error
        ? meQueryError.message
        : "프로필을 불러오지 못했습니다.";
    toast.error(msg);
  }, [meQueryFailed, meQueryError]);

  useEffect(() => {
    if (!adminUsersFailed) return;
    const msg =
      adminUsersError instanceof Error
        ? adminUsersError.message
        : "사용자 목록을 불러오지 못했습니다.";
    toast.error(msg);
  }, [adminUsersFailed, adminUsersError]);

  const displayUrl = previewUrl ?? profile?.imageUrl ?? null;

  const meErrMsg =
    meQueryFailed && meQueryError instanceof Error
      ? meQueryError.message
      : meQueryFailed
        ? "프로필을 불러오지 못했습니다."
        : null;

  const errMsg =
    updateProfile.error instanceof Error
      ? updateProfile.error.message
      : updateProfile.isError
        ? "요청에 실패했습니다."
        : null;

  const adminOtherErrMsg =
    adminSetOtherRole.error instanceof Error
      ? adminSetOtherRole.error.message
      : adminSetOtherRole.isError
        ? "역할 지정에 실패했습니다."
        : null;

  const adminListErrMsg =
    adminUsersFailed && adminUsersError instanceof Error
      ? adminUsersError.message
      : adminUsersFailed
        ? "사용자 목록을 불러오지 못했습니다."
        : null;

  const alertMessage =
    meErrMsg ?? errMsg ?? adminOtherErrMsg ?? adminListErrMsg;

  const busy = updateProfile.isPending;
  const roleBusy = updateRole.isPending;
  const adminOtherBusy = adminSetOtherRole.isPending;
  const serverRole = profile?.role === "admin" ? "admin" : "user";
  const roleDirty = roleDraft !== serverRole;

  const nameTrimmed = nameDraft.trim();
  const nameLenOk =
    nameTrimmed.length > 0 && nameTrimmed.length <= DISPLAY_NAME_MAX;
  const nameDirty =
    nameTrimmed !== (profile?.name ?? "").trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">내 정보</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          표시 이름·프로필 이미지·계정 유형을 확인·변경할 수 있습니다.
        </p>
      </div>

      <FormErrorAlert message={alertMessage} />

      <Card>
        <CardHeader>
          <CardTitle>계정</CardTitle>
          <CardDescription>현재 로그인 세션의 사용자 식별 값입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 font-mono text-sm">
          <p>
            <span className="text-muted-foreground">sub:</span> {profile?.sub}
          </p>
          <p>
            <span className="text-muted-foreground">email:</span> {profile?.email}
          </p>
          <div className="space-y-2 border-t border-border pt-4 font-sans">
            <p className="text-xs font-medium text-muted-foreground">
              계정 유형
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant={isAdminUser(profile) ? "default" : "secondary"}
                className="text-xs font-medium"
              >
                {isAdminUser(profile) ? "관리자" : "일반 사용자"}
              </Badge>
              {isAdminUser(profile) ? (
                <>
                  <Select
                    value={roleDraft}
                    onValueChange={(v) => {
                      updateRole.reset();
                      setRoleDraft(v === "admin" ? "admin" : "user");
                    }}
                    disabled={roleBusy}
                  >
                    <SelectTrigger className="h-9 w-[200px] font-sans">
                      <SelectValue placeholder="유형 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">일반 사용자</SelectItem>
                      <SelectItem value="admin">관리자</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="font-sans"
                    disabled={!roleDirty || roleBusy}
                    onClick={() => {
                      updateRole.reset();
                      updateRole.mutate(roleDraft);
                    }}
                  >
                    {roleBusy ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="size-4 shrink-0" />
                        저장 중…
                      </span>
                    ) : (
                      "유형 저장"
                    )}
                  </Button>
                </>
              ) : (
                <p className="max-w-md text-xs text-muted-foreground">
                  관리자 권한은 DB에 저장됩니다. 관리자는 프로필 이미지 아래
                  «다른 사용자 역할»에서 계정별로 지정할 수 있습니다. (선택) 서버
                  부팅 시 BOOTSTRAP_ADMIN_EMAILS로 최초 시드도 가능합니다.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>표시 이름</CardTitle>
          <CardDescription>
            글 작성자·댓글·헤더 등에 보이는 이름입니다. 최대 {DISPLAY_NAME_MAX}자입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.reset();
              if (!nameLenOk || !nameDirty) return;
              updateProfile.mutate({ name: nameTrimmed });
            }}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor={nameInputId}>이름</Label>
              <Input
                id={nameInputId}
                name="displayName"
                maxLength={DISPLAY_NAME_MAX}
                value={nameDraft}
                onChange={(e) => {
                  updateProfile.reset();
                  setNameDraft(e.target.value);
                }}
                autoComplete="nickname"
                aria-invalid={nameDraft.trim().length > DISPLAY_NAME_MAX}
              />
              {nameDraft.length > DISPLAY_NAME_MAX ? (
                <p className="text-xs text-destructive">
                  {DISPLAY_NAME_MAX}자 이하로 입력해 주세요.
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              size="sm"
              className="shrink-0"
              disabled={!nameLenOk || !nameDirty || busy}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4 shrink-0" />
                  저장 중…
                </span>
              ) : (
                "이름 저장"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>프로필 이미지</CardTitle>
          <CardDescription>
            JPEG, PNG, GIF, WebP · 최대 2MB. 저장 후 헤더에 원형으로 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {displayUrl ? (
              <SafeImage
                src={displayUrl}
                alt=""
                className="size-24 shrink-0 rounded-full object-cover ring-2 ring-border"
                placeholderLabel="프로필 이미지"
                fallback={
                  <div
                    className="flex size-24 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-2 ring-border"
                    aria-hidden
                  >
                    없음
                  </div>
                }
              />
            ) : (
              <div
                className="flex size-24 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-2 ring-border"
                aria-hidden
              >
                없음
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateProfile.reset();
                  if (!pickedFile) return;
                  updateProfile.mutate({ image: pickedFile });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor={fileInputId}>이미지 파일</Label>
                  <input
                    key={fileKey}
                    id={fileInputId}
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
                    onChange={(e) => {
                      updateProfile.reset();
                      releaseLocalPreview();
                      const f = e.target.files?.[0] ?? null;
                      if (f) {
                        const u = URL.createObjectURL(f);
                        blobUrlRef.current = u;
                        setPreviewUrl(u);
                        setPickedFile(f);
                      }
                    }}
                  />
                </div>
                <Button type="submit" size="sm" disabled={!pickedFile || busy}>
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="mr-2 size-4 shrink-0" />
                      처리 중…
                    </span>
                  ) : (
                    "이미지 저장"
                  )}
                </Button>
              </form>

              {profile?.imageUrl ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      updateProfile.reset();
                      updateProfile.mutate({ removeImage: true });
                    }}
                  >
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="mr-2 size-4 shrink-0" />
                        처리 중…
                      </span>
                    ) : (
                      "이미지 제거"
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>다른 사용자 역할</CardTitle>
            <CardDescription>
              본인을 제외한 전체 계정입니다. 행마다 일반 사용자 또는 관리자로
              저장할 수 있습니다. 마지막 남은 관리자는 일반 사용자로 내릴 수 없습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {adminUsersLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4 shrink-0" />
                사용자 목록을 불러오는 중…
              </p>
            ) : adminUsersFailed ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-destructive">
                  목록을 불러오지 못했습니다.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void refetchAdminUsers()}
                >
                  다시 시도
                </Button>
              </div>
            ) : otherUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                다른 사용자가 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[580px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="w-14 px-3 py-2 font-medium">아바타</th>
                      <th className="px-3 py-2 font-medium">이름</th>
                      <th className="px-3 py-2 font-medium">이메일</th>
                      <th className="px-3 py-2 font-medium">역할</th>
                      <th className="w-28 px-3 py-2 font-medium"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherUsers.map((u) => {
                      const serverRole = u.role === "admin" ? "admin" : "user";
                      const draftRole = otherRolesDraft[u.id] ?? serverRole;
                      const dirty = draftRole !== serverRole;
                      const rowSaving =
                        adminOtherBusy &&
                        adminSetOtherRole.variables?.userId === u.id;
                      const avatarResolved = publicAssetUrl(u.imageUrl ?? null);
                      const hasAvatar =
                        typeof avatarResolved === "string" &&
                        avatarResolved.length > 0;
                      return (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="px-3 py-2 align-middle">
                            {hasAvatar ? (
                              <SafeImage
                                src={avatarResolved}
                                alt=""
                                className="size-9 shrink-0 rounded-full object-cover ring-1 ring-border"
                                placeholderLabel={u.name}
                                fallback={
                                  <div
                                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-1 ring-border"
                                    aria-hidden
                                  >
                                    —
                                  </div>
                                }
                              />
                            ) : (
                              <div
                                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-1 ring-border"
                                aria-hidden
                              >
                                없음
                              </div>
                            )}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2 align-middle">
                            {u.name}
                          </td>
                          <td className="max-w-[220px] truncate px-3 py-2 align-middle text-muted-foreground">
                            {u.email}
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <Select
                              value={draftRole}
                              onValueChange={(v) => {
                                adminSetOtherRole.reset();
                                setOtherRolesDraft((prev) => ({
                                  ...prev,
                                  [u.id]: v === "admin" ? "admin" : "user",
                                }));
                              }}
                              disabled={adminOtherBusy}
                            >
                              <SelectTrigger className="h-9 w-[160px] font-sans">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">일반 사용자</SelectItem>
                                <SelectItem value="admin">관리자</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="font-sans"
                              disabled={!dirty || adminOtherBusy}
                              onClick={() => {
                                adminSetOtherRole.reset();
                                adminSetOtherRole.mutate({
                                  userId: u.id,
                                  email: u.email,
                                  role: draftRole,
                                });
                              }}
                            >
                              {rowSaving ? (
                                <span className="inline-flex items-center gap-1">
                                  <Spinner className="size-3.5 shrink-0" />
                                  저장
                                </span>
                              ) : (
                                "저장"
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
