"use client";

// 승인 워크플로 컨트롤 — 상태 배지(작성 중/검토 중/게시됨) + 전환 버튼 + 감사 이력 다이얼로그.
// 전이 규칙: 작성 중→검토 요청(편집 권한자), 검토 중→승인·게시(관리자)/반려·취소(작성자·관리자),
// 게시됨→게시 철회(작성자·관리자). 서버에서 같은 규칙으로 재검증한다.
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, History, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  BOOK_AUDIT_ACTION_LABEL,
  BOOK_STATUS_LABEL,
  type BookDetail,
  type BookStatus,
  fetchBookAudit,
  setBookStatus,
} from "@/lib/api";
import { canEditAsOwnerOrAdmin, isAdminUser } from "@/lib/authz";
import { formatDateMediumShort } from "@/lib/format-date";
import { bookKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

const STATUS_BADGE_CLASS: Record<BookStatus, string> = {
  draft: "border-0 bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
  review: "border-0 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  published:
    "border-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export function BookStatusControls({
  book,
  onChanged,
}: {
  book: BookDetail;
  /** 상태 전환 성공 시 갱신된 북 전달(상세 캐시 동기화) */
  onChanged: (book: BookDetail) => void;
}) {
  const { user } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);
  const status: BookStatus = book.status ?? "published";
  const isOwnerOrAdmin = canEditAsOwnerOrAdmin(user, book.author.id);
  const admin = isAdminUser(user);

  const statusMutation = useMutation({
    mutationFn: (next: BookStatus) => setBookStatus(book.id, next),
    onSuccess: (res, next) => {
      onChanged(res);
      toast.success(
        next === "review"
          ? "검토를 요청했습니다. 관리자가 승인하면 게시됩니다."
          : next === "published"
            ? "승인·게시했습니다."
            : status === "published"
              ? "게시를 철회했습니다. 작성 중 상태로 돌아갑니다."
              : "검토를 취소했습니다.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const auditQuery = useQuery({
    queryKey: [...bookKeys.detail(book.id), "audit"],
    queryFn: () => fetchBookAudit(book.id),
    enabled: historyOpen,
  });

  const pending = statusMutation.isPending;
  const btnClass = "h-7 px-2.5 text-xs";

  return (
    <div className="flex items-center gap-1.5">
      <Badge className={cn("shrink-0 text-[11px]", STATUS_BADGE_CLASS[status])}>
        {BOOK_STATUS_LABEL[status]}
      </Badge>
      {status === "draft" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={btnClass}
          disabled={pending}
          onClick={() => statusMutation.mutate("review")}
        >
          검토 요청
        </Button>
      ) : null}
      {status === "review" && admin ? (
        <>
          <Button
            type="button"
            size="sm"
            className={cn(
              btnClass,
              "border-transparent bg-emerald-600 text-white hover:bg-emerald-700",
            )}
            disabled={pending}
            onClick={() => statusMutation.mutate("published")}
          >
            <CheckCircle2 className="mr-1 size-3.5" aria-hidden />
            승인·게시
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={btnClass}
            disabled={pending}
            onClick={() => statusMutation.mutate("draft")}
          >
            반려
          </Button>
        </>
      ) : null}
      {status === "review" && !admin && isOwnerOrAdmin ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={btnClass}
          disabled={pending}
          onClick={() => statusMutation.mutate("draft")}
        >
          검토 취소
        </Button>
      ) : null}
      {status === "published" && isOwnerOrAdmin ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={btnClass}
          disabled={pending}
          onClick={() => statusMutation.mutate("draft")}
        >
          <Undo2 className="mr-1 size-3.5" aria-hidden />
          게시 철회
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        title="변경 이력(감사 로그)"
        onClick={() => {
          if (!user) {
            toast.error("로그인이 필요합니다.");
            return;
          }
          setHistoryOpen(true);
        }}
      >
        <History className="size-3.5" aria-hidden />
        이력
      </Button>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" aria-hidden />
              변경 이력
            </DialogTitle>
            <DialogDescription>
              「{book.title}」에 누가 언제 무엇을 했는지 최신순으로 보여줍니다.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
            {auditQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="size-5" />
              </div>
            ) : (auditQuery.data?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                아직 기록된 이력이 없습니다.
              </p>
            ) : (
              auditQuery.data!.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start gap-2 rounded px-1.5 py-1.5 text-sm hover:bg-muted/50"
                >
                  <Badge
                    variant="secondary"
                    className="mt-0.5 shrink-0 text-[10px]"
                  >
                    {BOOK_AUDIT_ACTION_LABEL[row.action]}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm">{row.detail}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.actorName} · {formatDateMediumShort(row.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setHistoryOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
