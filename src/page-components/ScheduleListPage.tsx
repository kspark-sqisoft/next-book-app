"use client";

// 스케줄 목록: DB 기반 생성·삭제. 기본 재생 콘텐츠와 적용 디바이스를 보여준다.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  createCretaSchedule,
  deleteCretaSchedule,
  fetchCretaSchedules,
} from "@/lib/creta-api";
import { cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

export function ScheduleListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const { data: schedules, isLoading } = useQuery({
    queryKey: cretaKeys.schedules(),
    queryFn: fetchCretaSchedules,
  });

  const createMutation = useMutation({
    mutationFn: () => createCretaSchedule({ name }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.schedules() });
      queryClient.setQueryData(cretaKeys.schedule(res.id), res);
      setCreateOpen(false);
      setName("");
      router.push(`/schedules/${res.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCretaSchedule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.all });
      toast.success("스케줄을 삭제했습니다.");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">스케줄</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            날짜·시간대별 재생 편성표
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            if (!user) {
              toast.error("로그인이 필요합니다.");
              return;
            }
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />새 스케줄
        </Button>
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        저장된 스케줄{" "}
        <span className="text-foreground">{schedules?.length ?? 0}</span>
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : (schedules?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            아직 스케줄이 없습니다. “새 스케줄”로 편성표를 만들어 보세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(schedules ?? []).map((schedule) => (
            <Card
              key={schedule.id}
              className="h-full gap-3 transition-colors hover:border-primary/50"
            >
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/schedules/${schedule.id}`}
                    className="flex min-w-0 items-center gap-2 outline-none"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarDays className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {schedule.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        시간대 {schedule.slotCount}개
                        {schedule.autoApply ? " · 자동 적용" : ""}
                      </span>
                    </span>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${schedule.name} 삭제`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (!user) {
                        toast.error("로그인이 필요합니다.");
                        return;
                      }
                      setDeleteTarget({ id: schedule.id, name: schedule.name });
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">기본 재생</p>
                  <p className="mt-0.5 truncate text-sm font-medium">
                    {schedule.defaultContent?.title ?? "지정 안 함"}
                  </p>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  {schedule.appliedDeviceNames.length > 0 ? (
                    <>
                      <Badge className="shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        디바이스 {schedule.appliedDeviceNames.length}대 적용 중
                      </Badge>
                      <span className="truncate text-xs text-muted-foreground">
                        {schedule.appliedDeviceNames.join(", ")}
                      </span>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="shrink-0">
                        미적용
                      </Badge>
                      <span className="truncate text-xs text-muted-foreground">
                        배정된 디바이스 없음
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 새 스케줄 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>새 스케줄</DialogTitle>
            <DialogDescription>
              만든 뒤 상세 화면에서 시간대를 편성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="schedule-name">이름</Label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 본사 로비 평일 운영"
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "만드는 중…" : "만들기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>스케줄 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」을(를) 삭제합니다. 이 스케줄을 재생 중인
              디바이스는 재생 소스가 해제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
