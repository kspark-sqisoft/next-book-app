"use client";

// 마이페이지: 조직 트리·멤버십 (슈퍼 관리자 / 조직 관리자)
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  addOrgMember,
  createOrganization,
  deleteOrganization,
  fetchOrganizations,
  fetchOrgCapabilities,
  fetchOrgMembers,
  type OrgListItem,
  removeOrgMember,
  setOrgMemberRole,
} from "@/lib/api";
import { orgKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

function buildTree(
  items: OrgListItem[],
): Array<OrgListItem & { depth: number }> {
  const byParent = new Map<number | null, OrgListItem[]>();
  for (const item of items) {
    const key = item.parentId;
    const list = byParent.get(key) ?? [];
    list.push(item);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }
  const out: Array<OrgListItem & { depth: number }> = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const node of byParent.get(parentId) ?? []) {
      out.push({ ...node, depth });
      walk(node.id, depth + 1);
    }
  };
  walk(null, 0);
  // orphan (parent not in list) — still show
  const seen = new Set(out.map((o) => o.id));
  for (const item of items) {
    if (!seen.has(item.id)) out.push({ ...item, depth: 0 });
  }
  return out;
}

export function OrgManagementCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [newRootName, setNewRootName] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "member">("member");

  const {
    data: caps,
    isLoading: capsLoading,
    isError: capsFailed,
    error: capsError,
  } = useQuery({
    queryKey: orgKeys.capabilities(),
    queryFn: fetchOrgCapabilities,
    enabled: Boolean(user),
  });

  const canSeeOrgs =
    Boolean(caps?.isSuperOrgAdmin) ||
    (caps?.memberOrganizationIds.length ?? 0) > 0 ||
    (caps?.adminOrganizationIds.length ?? 0) > 0;

  const {
    data: orgs = [],
    isLoading: orgsLoading,
    isError: orgsFailed,
    error: orgsError,
  } = useQuery({
    queryKey: orgKeys.list(),
    queryFn: fetchOrganizations,
    enabled: Boolean(user) && canSeeOrgs,
  });

  const tree = useMemo(() => buildTree(orgs), [orgs]);
  const selected = orgs.find((o) => o.id === selectedOrgId) ?? null;
  const isSuper = Boolean(caps?.isSuperOrgAdmin);
  const canManageSelected =
    isSuper ||
    (selectedOrgId != null &&
      (caps?.adminOrganizationIds ?? []).includes(selectedOrgId));

  const {
    data: members = [],
    isLoading: membersLoading,
    isError: membersFailed,
    error: membersError,
  } = useQuery({
    queryKey: orgKeys.members(selectedOrgId ?? 0),
    queryFn: () => fetchOrgMembers(selectedOrgId!),
    enabled: Boolean(user) && selectedOrgId != null && canManageSelected,
  });

  const invalidateOrgs = async () => {
    await queryClient.invalidateQueries({ queryKey: orgKeys.all });
  };

  const createMut = useMutation({
    mutationFn: createOrganization,
    onSuccess: async (created) => {
      toast.success(`「${created.name}」조직을 만들었습니다.`);
      setNewRootName("");
      setNewChildName("");
      setSelectedOrgId(created.id);
      await invalidateOrgs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteOrganization,
    onSuccess: async () => {
      toast.success("조직을 삭제했습니다.");
      setSelectedOrgId(null);
      await invalidateOrgs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMemberMut = useMutation({
    mutationFn: (input: { email: string; role: "admin" | "member" }) =>
      addOrgMember(selectedOrgId!, input),
    onSuccess: async (m) => {
      toast.success(`${m.email} 님을 추가했습니다.`);
      setMemberEmail("");
      await queryClient.invalidateQueries({
        queryKey: orgKeys.members(selectedOrgId!),
      });
      await invalidateOrgs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRoleMut = useMutation({
    mutationFn: (input: { userId: number; role: "admin" | "member" }) =>
      setOrgMemberRole(selectedOrgId!, input.userId, input.role),
    onSuccess: async () => {
      toast.success("역할을 변경했습니다.");
      await queryClient.invalidateQueries({
        queryKey: orgKeys.members(selectedOrgId!),
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: number) => removeOrgMember(selectedOrgId!, userId),
    onSuccess: async () => {
      toast.success("멤버를 제거했습니다.");
      await queryClient.invalidateQueries({
        queryKey: orgKeys.members(selectedOrgId!),
      });
      await invalidateOrgs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  if (capsLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (capsFailed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">조직</CardTitle>
        </CardHeader>
        <CardContent>
          <FormErrorAlert
            message={
              capsError instanceof Error
                ? capsError.message
                : "조직 권한을 불러오지 못했습니다."
            }
          />
        </CardContent>
      </Card>
    );
  }
  if (!canSeeOrgs && !isSuper) {
    return null;
  }

  return (
    <Card id="orgs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4" aria-hidden />
          조직
        </CardTitle>
        <CardDescription>
          {isSuper
            ? "대그룹·하위 조직(공장 등)을 만들고, 조직 관리자·멤버를 지정할 수 있습니다."
            : "소속 조직과, 관리 중인 조직의 멤버를 관리합니다."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isSuper ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              슈퍼 관리자 · 조직 만들기
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="org-root-name">대그룹 이름</Label>
                <Input
                  id="org-root-name"
                  value={newRootName}
                  onChange={(e) => setNewRootName(e.target.value)}
                  placeholder="예: 현대 자동차"
                  maxLength={200}
                />
              </div>
              <Button
                type="button"
                disabled={!newRootName.trim() || createMut.isPending}
                onClick={() =>
                  createMut.mutate({ name: newRootName, parentId: null })
                }
              >
                {createMut.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  "대그룹 추가"
                )}
              </Button>
            </div>
            {selected ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="org-child-name">
                    「{selected.name}」 하위 조직
                  </Label>
                  <Input
                    id="org-child-name"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    placeholder="예: 현대 자동차 울산 공장"
                    maxLength={200}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!newChildName.trim() || createMut.isPending}
                  onClick={() =>
                    createMut.mutate({
                      name: newChildName,
                      parentId: selected.id,
                    })
                  }
                >
                  하위 조직 추가
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                하위 조직을 만들려면 왼쪽 목록에서 상위 조직을 먼저 선택하세요.
              </p>
            )}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">조직 목록</p>
            {orgsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="size-5 text-muted-foreground" />
              </div>
            ) : orgsFailed ? (
              <FormErrorAlert
                message={
                  orgsError instanceof Error
                    ? orgsError.message
                    : "목록을 불러오지 못했습니다."
                }
              />
            ) : tree.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                아직 조직이 없습니다.
              </p>
            ) : (
              <ul className="max-h-80 space-y-0.5 overflow-y-auto rounded-md border border-border p-1">
                {tree.map((o) => {
                  const active = o.id === selectedOrgId;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          active
                            ? "bg-primary/15 font-medium text-foreground"
                            : "hover:bg-muted/80 text-muted-foreground hover:text-foreground",
                        )}
                        style={{ paddingLeft: `${0.5 + o.depth * 0.85}rem` }}
                        onClick={() => setSelectedOrgId(o.id)}
                      >
                        {o.depth > 0 ? (
                          <ChevronRight
                            className="size-3.5 shrink-0 opacity-50"
                            aria-hidden
                          />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">
                          {o.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                          {o.memberCount}명
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {isSuper && selected ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="w-full sm:w-auto"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `「${selected.name}」와 하위 조직·멤버십을 모두 삭제할까요?`,
                    )
                  ) {
                    return;
                  }
                  deleteMut.mutate(selected.id);
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                선택 조직 삭제
              </Button>
            ) : null}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">
              {selected ? `멤버 · ${selected.name}` : "멤버"}
            </p>
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                조직을 선택하면 멤버를 볼 수 있습니다.
              </p>
            ) : !canManageSelected ? (
              <p className="text-sm text-muted-foreground">
                이 조직의 멤버 관리는 조직 관리자 또는 슈퍼 관리자만 가능합니다.
              </p>
            ) : (
              <>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Label htmlFor="org-member-email">사용자 추가 (이메일)</Label>
                  <Input
                    id="org-member-email"
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="user@example.com"
                    autoComplete="off"
                  />
                  {isSuper ? (
                    <div className="space-y-1.5">
                      <Label>조직 내 역할</Label>
                      <Select
                        value={memberRole}
                        onValueChange={(v) =>
                          setMemberRole(v === "admin" ? "admin" : "member")
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">멤버</SelectItem>
                          <SelectItem value="admin">
                            조직 관리자 (공장 어드민)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      조직 관리자는 멤버만 추가할 수 있습니다.
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={!memberEmail.trim() || addMemberMut.isPending}
                    onClick={() =>
                      addMemberMut.mutate({
                        email: memberEmail,
                        role: isSuper ? memberRole : "member",
                      })
                    }
                  >
                    {addMemberMut.isPending ? (
                      <Spinner className="size-4" />
                    ) : (
                      "추가"
                    )}
                  </Button>
                </div>

                {membersLoading ? (
                  <div className="flex justify-center py-6">
                    <Spinner className="size-5 text-muted-foreground" />
                  </div>
                ) : membersFailed ? (
                  <FormErrorAlert
                    message={
                      membersError instanceof Error
                        ? membersError.message
                        : "멤버를 불러오지 못했습니다."
                    }
                  />
                ) : members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    아직 멤버가 없습니다.
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto">
                    {members.map((m) => (
                      <li
                        key={m.userId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {m.name || "—"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {m.email}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isSuper ? (
                            <Select
                              value={m.role}
                              onValueChange={(v) =>
                                setRoleMut.mutate({
                                  userId: m.userId,
                                  role: v === "admin" ? "admin" : "member",
                                })
                              }
                              disabled={setRoleMut.isPending}
                            >
                              <SelectTrigger className="h-8 w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">멤버</SelectItem>
                                <SelectItem value="admin">관리자</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              {m.role === "admin" ? "관리자" : "멤버"}
                            </Badge>
                          )}
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`${m.email} 제거`}
                            disabled={removeMemberMut.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `${m.email} 님을 이 조직에서 제거할까요?`,
                                )
                              ) {
                                return;
                              }
                              removeMemberMut.mutate(m.userId);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
