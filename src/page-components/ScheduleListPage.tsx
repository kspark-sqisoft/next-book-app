"use client";

// 스케줄 목록: DB 기반 생성·삭제. 기본 재생 콘텐츠와 적용 디바이스를 보여준다.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Play, Plus, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useCretaCoverThumbs } from "@/components/creta/CretaCoverThumb";
import {
  CretaViewToggle,
  useCretaListView,
} from "@/components/creta/CretaViewToggle";
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
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";
import { canManageOwned } from "@/lib/authz";
import {
  CARD_GRID_COLUMNS,
  GRID_CARD_HOVER,
  LIST_ROW_HOVER,
} from "@/lib/card-hover";
import {
  createCretaSchedule,
  deleteCretaSchedule,
  fetchCretaSchedules,
  sharedWithSummary,
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
  /** 보기 형태 — 기존 모양(그리드)이 기본, 디바이스처럼 리스트로 전환 가능 */
  const [view, changeView] = useCretaListView("creta-schedule-view", "grid");

  const { data: schedules, isLoading } = useQuery({
    queryKey: cretaKeys.schedules(),
    queryFn: fetchCretaSchedules,
  });
  // 카드 배경 = 지금 재생 중(없으면 기본 재생) 콘텐츠의 첫 슬라이드 썸네일
  const thumbEntries = useMemo(
    () =>
      (schedules ?? []).map((s) => ({
        key: `schedule-${s.id}`,
        cover: s.currentContent?.cover ?? s.defaultContent?.cover ?? null,
      })),
    [schedules],
  );
  const thumbs = useCretaCoverThumbs(thumbEntries);

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

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          저장된 스케줄{" "}
          <span className="text-foreground">{schedules?.length ?? 0}</span>
        </p>
        <CretaViewToggle view={view} onChange={changeView} />
      </div>

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
      ) : view === "list" ? (
        /* 리스트 보기 — 작은 썸네일 + 편성 요약 한 줄 */
        <div className="space-y-2">
          {(schedules ?? []).map((schedule) => {
            const thumb = thumbs[`schedule-${schedule.id}`];
            return (
              <Card key={schedule.id} className={`py-0 ${LIST_ROW_HOVER}`}>
                <CardContent className="flex items-center gap-3 px-3 py-2.5">
                  <Link
                    href={`/schedules/${schedule.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted/40">
                      {thumb ? (
                        <SafeImage
                          src={thumb}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                          loading="lazy"
                          placeholderLabel={`${schedule.name} 재생 콘텐츠 썸네일`}
                        />
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center text-muted-foreground/30"
                          aria-hidden
                        >
                          <CalendarDays className="size-8" strokeWidth={1.25} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {schedule.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        <Play className="mr-1 inline size-3" aria-hidden />
                        {schedule.currentContent?.title ?? "재생 콘텐츠 없음"} ·
                        기본 {schedule.defaultContent?.title ?? "지정 안 함"}
                      </p>
                      <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                        <span>
                          시간대 {schedule.slotCount}
                          {schedule.autoApply ? " · 자동" : ""}
                        </span>
                        <span className="truncate">
                          · 작성자 {schedule.owner?.name || "공용"}
                        </span>
                        {schedule.sharedToAll ? (
                          <span className="inline-flex min-w-0 items-center gap-1 text-primary">
                            <Share2 className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">
                              모든 사용자에게 공유됨
                            </span>
                          </span>
                        ) : schedule.sharedWith.length > 0 ? (
                          <span
                            className="inline-flex min-w-0 items-center gap-1 text-primary"
                            title={schedule.sharedWith
                              .map((u) => u.name)
                              .join(", ")}
                          >
                            <Share2 className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">
                              {sharedWithSummary(schedule.sharedWith)}에게
                              공유됨
                            </span>
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {schedule.appliedDeviceNames.length > 0 ? (
                      <Badge
                        className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        title={schedule.appliedDeviceNames.join(", ")}
                      >
                        디바이스 {schedule.appliedDeviceNames.length}대
                      </Badge>
                    ) : (
                      <Badge variant="outline">미적용</Badge>
                    )}
                    {canManageOwned(user, schedule.owner?.id ?? null) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${schedule.name} 삭제`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setDeleteTarget({
                            id: schedule.id,
                            name: schedule.name,
                          })
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className={CARD_GRID_COLUMNS}>
          {(schedules ?? []).map((schedule) => {
            const thumb = thumbs[`schedule-${schedule.id}`];
            return (
              <Card
                key={schedule.id}
                className={`group/card h-full gap-3 py-4 ${GRID_CARD_HOVER}`}
              >
                {/* 카드 전체 클릭 → 상세 (삭제 버튼만 위 레이어) */}
                <Link
                  href={`/schedules/${schedule.id}`}
                  aria-label={`${schedule.name} 열기`}
                  className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <CardContent className="pointer-events-none relative z-10 space-y-3 px-4">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-muted/40">
                    {thumb ? (
                      <SafeImage
                        src={thumb}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                        loading="lazy"
                        placeholderLabel={`${schedule.name} 재생 콘텐츠 썸네일`}
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-muted-foreground/30"
                        aria-hidden
                      >
                        <CalendarDays className="size-12" strokeWidth={1.25} />
                      </div>
                    )}
                    <span className="absolute left-1.5 top-1.5 inline-flex max-w-[85%] items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      <Play className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">
                        {schedule.currentContent?.title ?? "재생 콘텐츠 없음"}
                      </span>
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      시간대 {schedule.slotCount}
                      {schedule.autoApply ? " · 자동" : ""}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading truncate text-sm font-semibold transition-colors group-hover/card:text-primary">
                      {schedule.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      기본 재생:{" "}
                      {schedule.defaultContent?.title ?? "지정 안 함"}
                    </p>
                    <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                      <span className="truncate">
                        작성자 {schedule.owner?.name || "공용"}
                      </span>
                      {schedule.sharedToAll ? (
                        <span className="inline-flex min-w-0 items-center gap-1 text-primary">
                          <Share2 className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            모든 사용자에게 공유됨
                          </span>
                        </span>
                      ) : schedule.sharedWith.length > 0 ? (
                        <span
                          className="inline-flex min-w-0 items-center gap-1 text-primary"
                          title={schedule.sharedWith
                            .map((u) => u.name)
                            .join(", ")}
                        >
                          <Share2 className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            {sharedWithSummary(schedule.sharedWith)}에게 공유됨
                          </span>
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      {schedule.appliedDeviceNames.length > 0 ? (
                        <>
                          <Badge className="shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            디바이스 {schedule.appliedDeviceNames.length}대 적용
                            중
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
                  </div>
                </CardContent>
                {canManageOwned(user, schedule.owner?.id ?? null) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${schedule.name} 삭제`}
                    title="스케줄 삭제"
                    className="absolute right-6 top-6 z-20 size-7 rounded-full border border-border bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover/card:opacity-100"
                    onClick={() =>
                      setDeleteTarget({ id: schedule.id, name: schedule.name })
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </Card>
            );
          })}
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
