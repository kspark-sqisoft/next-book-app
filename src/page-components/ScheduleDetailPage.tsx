"use client";

// 스케줄 상세: DB 시간대 편성. 시간대 추가(크레타북/플레이리스트 지정)·삭제,
// 기본 재생 지정, 자동 적용 토글, 디바이스 배정이 실제로 반영된다.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MonitorCheck, Plus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useCretaCoverThumbs } from "@/components/creta/CretaCoverThumb";
import {
  CretaSlotAddDialog,
  type CretaSlotDraft,
} from "@/components/creta/CretaSlotAddDialog";
import { CretaSourceDialog } from "@/components/creta/CretaSourceDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  addCretaScheduleSlot,
  type CretaScheduleDetail,
  type CretaScheduleSlot,
  fetchCretaSchedule,
  minutesToTime,
  removeCretaScheduleSlot,
  SLOT_REPEAT_LABEL,
  updateCretaDeviceSource,
  updateCretaSchedule,
  updateCretaScheduleSlot,
} from "@/lib/creta-api";
import { goBackOrPush } from "@/lib/navigate-back";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

/** 타임라인 세로 배율(px/분) — 24시간 = 1080px */
const PX_PER_MIN = 0.75;

type TimelineSegment = {
  key: string;
  startMin: number;
  endMin: number;
  title: string;
  kind: "default" | "book" | "playlist";
  note?: string;
  slotId?: number;
};

/** 지정 시간대 사이의 빈 구간을 기본 재생으로 채워 0~24시 전체 세그먼트를 만든다 */
function buildTimeline(
  slots: CretaScheduleSlot[],
  defaultTitle: string,
): TimelineSegment[] {
  const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);
  const segments: TimelineSegment[] = [];
  let cursor = 0;
  for (const slot of sorted) {
    if (slot.startMin > cursor) {
      segments.push({
        key: `default-${cursor}`,
        startMin: cursor,
        endMin: slot.startMin,
        title: defaultTitle,
        kind: "default",
      });
    }
    const repeatNote =
      slot.repeat === "range" && slot.repeatStart && slot.repeatEnd
        ? `${slot.repeatStart} ~ ${slot.repeatEnd}`
        : slot.repeat !== "once"
          ? SLOT_REPEAT_LABEL[slot.repeat]
          : undefined;
    segments.push({
      key: `slot-${slot.id}`,
      startMin: slot.startMin,
      endMin: slot.endMin,
      title: slot.content?.title ?? "삭제된 콘텐츠",
      kind: slot.content?.kind === "playlist" ? "playlist" : "book",
      note: repeatNote,
      slotId: slot.id,
    });
    cursor = Math.max(cursor, slot.endMin);
  }
  if (cursor < 24 * 60) {
    segments.push({
      key: `default-${cursor}`,
      startMin: cursor,
      endMin: 24 * 60,
      title: defaultTitle,
      kind: "default",
    });
  }
  return segments;
}

/** 달력 셀 계산용 월 정보(마운트 후 클라이언트에서만 생성 — SSR 불일치 방지) */
type CalendarInfo = {
  year: number;
  /** 0-based */
  month: number;
  todayDate: number;
  firstWeekday: number;
  daysInMonth: number;
};

function isoDateOf(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 반복 규칙상 해당 날짜에 이 시간대가 편성되는지 */
function slotAppliesToDate(
  slot: CretaScheduleSlot,
  year: number,
  month0: number,
  day: number,
): boolean {
  const weekday = new Date(year, month0, day).getDay();
  const iso = isoDateOf(year, month0, day);
  switch (slot.repeat) {
    case "daily":
      return true;
    case "weekday":
      return weekday >= 1 && weekday <= 5;
    case "weekend":
      return weekday === 0 || weekday === 6;
    case "range":
      return (
        Boolean(slot.repeatStart && slot.repeatEnd) &&
        slot.repeatStart! <= iso &&
        iso <= slot.repeatEnd!
      );
    default:
      // "이 날짜만" — 기준일 없는 옛 데이터는 모든 날짜에 표시
      return slot.repeatStart ? slot.repeatStart === iso : true;
  }
}

const SEGMENT_KIND_LABEL: Record<TimelineSegment["kind"], string> = {
  default: "기본 재생",
  book: "크레타북",
  playlist: "플레이리스트",
};

/** 빈 시간(기본 재생) 구간 스타일 */
const DEFAULT_SEGMENT_CLASS =
  "border-dashed border-border bg-muted/40 text-muted-foreground";

/** 지정 시간대별로 순환 배정하는 색상 팔레트 — 이웃 편성이 같은 색이 되지 않게 */
const SLOT_COLORS = [
  "border-rose-400/60 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "border-violet-400/60 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "border-sky-400/60 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
] as const;

export function ScheduleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const scheduleId = Number(params.id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [slotOpen, setSlotOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<CretaScheduleSlot | null>(null);
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  // 현재 시각 마커는 마운트 후 계산(SSR-클라이언트 불일치 방지)
  const [nowMarker, setNowMarker] = useState<{
    top: number;
    label: string;
  } | null>(null);
  // 이번 달 달력 + 선택 날짜(기본: 오늘) — 마운트 후 계산
  const [cal, setCal] = useState<CalendarInfo | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const now = new Date();
      setCal({
        year: now.getFullYear(),
        month: now.getMonth(),
        todayDate: now.getDate(),
        firstWeekday: new Date(now.getFullYear(), now.getMonth(), 1).getDay(),
        daysInMonth: new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
        ).getDate(),
      });
      setSelectedDay(now.getDate());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    // 시계(외부 시스템) 구독: 마운트 직후 1회 + 30초마다 마커 갱신
    const compute = () => {
      const now = new Date();
      const min = now.getHours() * 60 + now.getMinutes();
      setNowMarker({ top: min * PX_PER_MIN, label: minutesToTime(min) });
    };
    const initial = window.setTimeout(compute, 0);
    const tick = window.setInterval(compute, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(tick);
    };
  }, []);

  const {
    data: schedule,
    isLoading,
    isError,
  } = useQuery({
    queryKey: cretaKeys.schedule(scheduleId),
    queryFn: () => fetchCretaSchedule(scheduleId),
    enabled: Number.isFinite(scheduleId) && scheduleId > 0,
  });

  const applyDetail = (res: CretaScheduleDetail) => {
    queryClient.setQueryData(cretaKeys.schedule(scheduleId), res);
    void queryClient.invalidateQueries({ queryKey: cretaKeys.schedules() });
  };

  const addSlotMutation = useMutation({
    mutationFn: (draft: CretaSlotDraft) =>
      addCretaScheduleSlot(scheduleId, draft),
    onSuccess: (res) => {
      applyDetail(res);
      setSlotOpen(false);
      toast.success("시간대를 추가했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateSlotMutation = useMutation({
    mutationFn: (input: { slotId: number; draft: CretaSlotDraft }) =>
      updateCretaScheduleSlot(scheduleId, input.slotId, input.draft),
    onSuccess: (res) => {
      applyDetail(res);
      setEditSlot(null);
      toast.success("시간대를 수정했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeSlotMutation = useMutation({
    mutationFn: (slotId: number) => removeCretaScheduleSlot(scheduleId, slotId),
    onSuccess: applyDetail,
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateCretaSchedule>[1]) =>
      updateCretaSchedule(scheduleId, patch),
    onSuccess: (res) => {
      applyDetail(res);
      setDefaultOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const assignMutation = useMutation({
    mutationFn: (deviceId: number) =>
      updateCretaDeviceSource(deviceId, {
        type: "schedule",
        refId: scheduleId,
      }),
    onSuccess: (device) => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.all });
      setAssignOpen(false);
      toast.success(`「${device.name}」에 이 스케줄을 배정했습니다.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 시간대 블록 배경용 커버 썸네일(콘텐츠별)
  const slotThumbEntries = useMemo(
    () =>
      (schedule?.slots ?? []).map((s) => ({
        key: `slot-${s.id}`,
        cover: s.content?.cover ?? null,
      })),
    [schedule],
  );
  const thumbs = useCretaCoverThumbs(slotThumbEntries);

  const requireLogin = (): boolean => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return false;
    }
    return true;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (isError || !schedule) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          스케줄을 찾을 수 없습니다.
        </p>
        <Button asChild variant="outline">
          <Link href="/schedules">
            <ArrowLeft className="size-4" aria-hidden />
            스케줄 목록으로
          </Link>
        </Button>
      </div>
    );
  }

  const defaultTitle = schedule.defaultContent?.title ?? "기본 재생 없음";
  // 달력에서 고른 날짜에 편성되는 시간대만 타임라인에 표시
  const visibleSlots =
    cal && selectedDay !== null
      ? schedule.slots.filter((s) =>
          slotAppliesToDate(s, cal.year, cal.month, selectedDay),
        )
      : schedule.slots;
  const timeline = buildTimeline(visibleSlots, defaultTitle);
  const trackHeight = 24 * 60 * PX_PER_MIN;
  // 시작 시각 순서대로 팔레트를 순환 배정 — 이웃 편성끼리 항상 다른 색
  const slotColorById = new Map<number, string>();
  [...visibleSlots]
    .sort((a, b) => a.startMin - b.startMin)
    .forEach((s, i) => {
      slotColorById.set(s.id, SLOT_COLORS[i % SLOT_COLORS.length]!);
    });
  const selectedIso =
    cal && selectedDay !== null
      ? isoDateOf(cal.year, cal.month, selectedDay)
      : null;
  const selectedLabel =
    cal && selectedDay !== null
      ? `${cal.year}년 ${cal.month + 1}월 ${selectedDay}일`
      : null;
  const selectedIsToday = cal !== null && selectedDay === cal.todayDate;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => goBackOrPush(router, "/schedules")}
        className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        스케줄
      </button>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold">{schedule.name}</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {schedule.appliedDevices.length > 0
                ? `적용 디바이스 ${schedule.appliedDevices.length}대 · ${schedule.appliedDevices.map((d) => d.name).join(", ")}`
                : "적용된 디바이스 없음"}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => requireLogin() && setAssignOpen(true)}
          >
            <MonitorCheck className="size-4" aria-hidden />
            디바이스 배정
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* 월 달력 — 날짜 클릭 시 해당 일 편성을 타임라인에 표시 */}
          <Card>
            <CardContent className="space-y-3">
              {cal ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {cal.year}년 {cal.month + 1}월
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setSelectedDay(cal.todayDate)}
                    >
                      오늘
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                    {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                      <span
                        key={d}
                        className={cn(
                          "py-1 font-medium text-muted-foreground",
                          i === 0 && "text-rose-500",
                          i === 6 && "text-sky-500",
                        )}
                      >
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: cal.firstWeekday }, (_, i) => (
                      <span key={`empty-${i}`} />
                    ))}
                    {Array.from(
                      { length: cal.daysInMonth },
                      (_, i) => i + 1,
                    ).map((day) => {
                      const isToday = day === cal.todayDate;
                      const isSelected = day === selectedDay;
                      const hasSlot = schedule.slots.some((s) =>
                        slotAppliesToDate(s, cal.year, cal.month, day),
                      );
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          aria-label={`${cal.month + 1}월 ${day}일 편성 보기`}
                          className={cn(
                            "relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-md text-xs tabular-nums transition-colors",
                            isSelected
                              ? "bg-primary font-semibold text-primary-foreground"
                              : isToday
                                ? "bg-primary/10 font-semibold text-primary"
                                : "hover:bg-muted",
                          )}
                        >
                          <span>{day}</span>
                          {isToday ? (
                            <span
                              className={cn(
                                "text-[8px] font-semibold leading-none",
                                isSelected
                                  ? "text-primary-foreground/90"
                                  : "text-primary",
                              )}
                            >
                              Today
                            </span>
                          ) : null}
                          {hasSlot && !isToday ? (
                            <span
                              className={cn(
                                "absolute bottom-1 size-1 rounded-full",
                                isSelected
                                  ? "bg-primary-foreground/80"
                                  : "bg-primary/60",
                              )}
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex justify-center py-10">
                  <Spinner className="size-5" />
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold">기본 재생</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  지정된 시간대가 없는 빈 시간에 재생됩니다.
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <div className="min-w-0">
                  {schedule.defaultContent ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {schedule.defaultContent.kind === "book"
                          ? "크레타북"
                          : "플레이리스트"}
                      </p>
                      <p className="truncate text-sm font-medium">
                        {schedule.defaultContent.title}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">지정 안 함</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => requireLogin() && setDefaultOpen(true)}
                >
                  변경
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">스케줄 자동 적용</span>
                <Switch
                  checked={schedule.autoApply}
                  disabled={updateMutation.isPending}
                  onCheckedChange={(checked) =>
                    requireLogin() &&
                    updateMutation.mutate({ autoApply: checked })
                  }
                  aria-label="스케줄 자동 적용"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">편성 안내</p>
              <p>
                타임라인은 하루(00:00~24:00) 기준입니다. 반복 설정(평일·주말
                등)에 따라 해당하는 날짜에 같은 편성이 적용됩니다.
              </p>
              <p>시간대는 서로 겹칠 수 없습니다.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-base font-semibold">
                  {selectedLabel ?? "하루 편성표"}
                  {selectedIsToday ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Today
                    </Badge>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  지정된 시간대 {visibleSlots.length}개 · 나머지는 기본 재생
                </p>
              </div>
              <Button
                type="button"
                onClick={() => requireLogin() && setSlotOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                시간대 추가
              </Button>
            </div>

            <div className="flex gap-2">
              {/* 시간 눈금 */}
              <div
                className="relative w-10 shrink-0 text-right"
                style={{ height: trackHeight }}
                aria-hidden
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <span
                    key={h}
                    className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                    style={{ top: h * 60 * PX_PER_MIN }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
              {/* 타임라인 트랙 */}
              <div className="relative flex-1" style={{ height: trackHeight }}>
                {timeline.map((seg) => {
                  const slot = seg.slotId
                    ? schedule.slots.find((s) => s.id === seg.slotId)
                    : undefined;
                  const thumb = seg.slotId
                    ? thumbs[`slot-${seg.slotId}`]
                    : undefined;
                  const inner = (
                    <>
                      <span className="tabular-nums">
                        {minutesToTime(seg.startMin)} –{" "}
                        {minutesToTime(seg.endMin)}
                      </span>
                      <span className="truncate font-semibold">
                        {seg.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-4 border-current px-1 text-[10px] text-current"
                      >
                        {SEGMENT_KIND_LABEL[seg.kind]}
                      </Badge>
                      {seg.note ? (
                        <span className="text-[10px] opacity-80">
                          {seg.note}
                        </span>
                      ) : null}
                    </>
                  );
                  return (
                    <div
                      key={seg.key}
                      className={cn(
                        "absolute inset-x-0 flex items-start justify-between gap-2 overflow-hidden rounded-md border px-2.5 py-1",
                        seg.slotId
                          ? (slotColorById.get(seg.slotId) ?? SLOT_COLORS[0])
                          : DEFAULT_SEGMENT_CLASS,
                      )}
                      style={{
                        top: seg.startMin * PX_PER_MIN,
                        height: Math.max(
                          (seg.endMin - seg.startMin) * PX_PER_MIN - 2,
                          16,
                        ),
                      }}
                    >
                      {/* 콘텐츠 커버를 은은한 배경으로 */}
                      {thumb ? (
                        <SafeImage
                          src={thumb}
                          alt=""
                          className="pointer-events-none absolute inset-0 size-full object-cover opacity-15 dark:opacity-10"
                          placeholderLabel={`「${seg.title}」 커버 배경`}
                        />
                      ) : null}
                      {slot ? (
                        <button
                          type="button"
                          aria-label={`${seg.title} 시간대 수정`}
                          title="클릭해서 수정"
                          className="relative z-10 flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-left text-[11px] outline-none focus-visible:underline sm:text-xs"
                          onClick={() => requireLogin() && setEditSlot(slot)}
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className="relative z-10 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs">
                          {inner}
                        </div>
                      )}
                      {seg.slotId ? (
                        <button
                          type="button"
                          className="relative z-10 shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
                          aria-label={`${seg.title} 시간대 삭제`}
                          disabled={removeSlotMutation.isPending}
                          onClick={() =>
                            requireLogin() &&
                            removeSlotMutation.mutate(seg.slotId!)
                          }
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {/* 현재 시각 마커 — 오늘 편성을 볼 때만 */}
                {nowMarker && (selectedIsToday || !cal) ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10"
                    style={{ top: nowMarker.top }}
                  >
                    <div className="h-px bg-rose-500" />
                    <span className="absolute -top-4 right-0 text-[10px] font-medium text-rose-500">
                      현재 {nowMarker.label}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 시간대 추가 */}
      {slotOpen ? (
        <CretaSlotAddDialog
          open={slotOpen}
          onOpenChange={setSlotOpen}
          pending={addSlotMutation.isPending}
          selectedDate={
            selectedIso && selectedLabel
              ? { iso: selectedIso, label: selectedLabel }
              : undefined
          }
          onSubmit={(draft) => addSlotMutation.mutate(draft)}
        />
      ) : null}

      {/* 시간대 수정 — 블록 클릭으로 진입 */}
      {editSlot ? (
        <CretaSlotAddDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditSlot(null);
          }}
          pending={updateSlotMutation.isPending}
          selectedDate={
            selectedIso && selectedLabel
              ? { iso: selectedIso, label: selectedLabel }
              : undefined
          }
          initial={{
            startMin: editSlot.startMin,
            endMin: editSlot.endMin,
            sourceType:
              editSlot.content?.kind === "playlist" ? "playlist" : "book",
            content: editSlot.content
              ? { id: editSlot.content.id, title: editSlot.content.title }
              : null,
            repeat: editSlot.repeat,
            repeatStart: editSlot.repeatStart,
            repeatEnd: editSlot.repeatEnd,
          }}
          onSubmit={(draft) =>
            updateSlotMutation.mutate({ slotId: editSlot.id, draft })
          }
        />
      ) : null}

      {/* 기본 재생 변경 */}
      {defaultOpen ? (
        <CretaSourceDialog
          open={defaultOpen}
          onOpenChange={setDefaultOpen}
          title="기본 재생 변경"
          description="빈 시간에 재생할 콘텐츠를 고릅니다."
          kinds={["book", "playlist"]}
          initialKind={
            schedule.defaultContent?.kind === "playlist" ? "playlist" : "book"
          }
          pending={updateMutation.isPending}
          clearLabel="지정 안 함"
          onClear={() => updateMutation.mutate({ defaultSourceType: "none" })}
          onSubmit={(kind, option) =>
            updateMutation.mutate(
              kind === "book"
                ? { defaultSourceType: "book", defaultBookId: option.id }
                : {
                    defaultSourceType: "playlist",
                    defaultPlaylistId: option.id,
                  },
            )
          }
        />
      ) : null}

      {/* 디바이스 배정 */}
      {assignOpen ? (
        <CretaSourceDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          title="디바이스 배정"
          description="선택한 디바이스의 재생 소스를 이 스케줄로 지정합니다."
          kinds={["device"]}
          pending={assignMutation.isPending}
          onSubmit={(_kind, option) => assignMutation.mutate(option.id)}
        />
      ) : null}
    </div>
  );
}
