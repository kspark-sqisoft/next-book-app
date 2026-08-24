"use client";

// 회원 공유 다이얼로그(북·플레이리스트·스케줄 공용) — 회원 목록에서 공유 대상을 켜고 끈다.
// 이미 공유된 사용자는 체크 표시. 토글 즉시 서버 반영(onToggle).
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Globe, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  type BookShareUser,
  fetchBookShareUsers,
  publicAssetUrl,
} from "@/lib/api";
import { bookKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 다이얼로그 제목(예: "북 공유") */
  title: string;
  /** 설명 문장 — 대상 이름·권한 안내 */
  description: string;
  /** 소유자 id — 목록에서 제외 */
  ownerId: number | null;
  /** 현재 공유된 사용자 id */
  sharedUserIds: readonly number[];
  /** 공유 추가/해제 요청 — 성공 시 호출부가 캐시를 갱신 */
  onToggle: (userId: number, shared: boolean) => Promise<unknown>;
  /** 모든 사용자 공유 상태 — onToggleShareAll과 함께 넘기면 "모든 사용자" 행 표시 */
  sharedToAll?: boolean;
  /** 모든 사용자 공유 켜기/끄기 요청 */
  onToggleShareAll?: (shared: boolean) => Promise<unknown>;
};

export function MemberShareDialog({
  open,
  onOpenChange,
  title,
  description,
  ownerId,
  sharedUserIds,
  onToggle,
  sharedToAll,
  onToggleShareAll,
}: Props) {
  const [search, setSearch] = useState("");
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);

  const shareAllMutation = useMutation({
    mutationFn: (shared: boolean) => {
      if (!onToggleShareAll) return Promise.resolve(undefined);
      return onToggleShareAll(shared);
    },
    onSuccess: (_res, shared) => {
      toast.success(
        shared
          ? "모든 사용자에게 공유했습니다."
          : "모든 사용자 공유를 해제했습니다.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const usersQuery = useQuery({
    queryKey: [...bookKeys.all, "share-users"],
    queryFn: fetchBookShareUsers,
    enabled: open,
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { userId: number; shared: boolean }) =>
      onToggle(input.userId, input.shared),
    onMutate: (input) => setPendingUserId(input.userId),
    onSuccess: (_res, input) => {
      const who =
        usersQuery.data?.find((u) => u.id === input.userId)?.name ||
        `#${input.userId}`;
      toast.success(
        input.shared
          ? `「${who}」에게 공유했습니다.`
          : `「${who}」 공유를 해제했습니다.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingUserId(null),
  });

  const shared = useMemo(() => new Set(sharedUserIds), [sharedUserIds]);
  const candidates: BookShareUser[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (usersQuery.data ?? [])
      .filter((u) => u.id !== ownerId)
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
  }, [usersQuery.data, ownerId, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {onToggleShareAll ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={sharedToAll === true}
              aria-label={
                sharedToAll ? "모든 사용자 공유 해제" : "모든 사용자 공유"
              }
              disabled={shareAllMutation.isPending}
              onClick={() => shareAllMutation.mutate(!sharedToAll)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border px-2 py-2 text-left transition-colors disabled:cursor-wait",
                sharedToAll
                  ? "border-primary/40 bg-primary/10 ring-1 ring-primary/40"
                  : "border-border hover:bg-muted",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Globe className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">모든 사용자</span>
                <span className="block text-xs text-muted-foreground">
                  모든 로그인 사용자가 편집할 수 있습니다.
                </span>
              </span>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  sharedToAll
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent",
                )}
                aria-hidden
              >
                {shareAllMutation.isPending ? (
                  <Spinner className="size-3.5 text-current" />
                ) : (
                  <Check className="size-3.5" />
                )}
              </span>
            </button>
          ) : null}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="text"
              inputMode="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름·이메일 검색…"
              className="h-9 pl-9"
              aria-label="회원 검색"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            공유 중 {sharedUserIds.length}명
            {search ? ` · 검색 결과 ${candidates.length}명` : ""}
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-1">
            {usersQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5" />
              </div>
            ) : usersQuery.isError ? (
              <p className="px-3 py-8 text-center text-sm text-destructive">
                회원 목록을 불러오지 못했습니다.
              </p>
            ) : candidates.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {search
                  ? "검색 결과가 없습니다."
                  : "공유할 수 있는 회원이 없습니다."}
              </p>
            ) : (
              candidates.map((u) => {
                const isShared = shared.has(u.id);
                const busy = pendingUserId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isShared}
                    aria-label={`${u.name || u.email} ${isShared ? "공유 해제" : "공유"}`}
                    disabled={toggleMutation.isPending}
                    onClick={() =>
                      toggleMutation.mutate({ userId: u.id, shared: !isShared })
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors disabled:cursor-wait",
                      isShared
                        ? "bg-primary/10 ring-1 ring-primary/40"
                        : "hover:bg-muted",
                    )}
                  >
                    <Avatar className="size-8 shrink-0">
                      {u.imageUrl ? (
                        <AvatarImage
                          src={publicAssetUrl(u.imageUrl) ?? undefined}
                          alt=""
                        />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {(u.name || u.email).trim().charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {u.name || "이름 없음"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border",
                        isShared
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent",
                      )}
                      aria-hidden
                    >
                      {busy ? (
                        <Spinner className="size-3.5 text-current" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
