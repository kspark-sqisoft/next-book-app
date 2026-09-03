"use client";

// 스케줄 "시간대 추가" 다이얼로그 — 시작·종료 시각, 재생 대상(크레타북/플레이리스트),
// 반복 방식을 받아 실제 시간대를 만든다.
import { useState } from "react";

import { CretaSourcePicker } from "@/components/creta/CretaSourcePicker";
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
import { Label } from "@/components/ui/label";
import {
  type CretaSlotRepeat,
  minutesToTime,
  SLOT_REPEAT_LABEL,
  timeToMinutes,
} from "@/features/creta/creta-api";
import { cn } from "@/lib/utils";

export type CretaSlotDraft = {
  startMin: number;
  endMin: number;
  sourceType: "book" | "playlist";
  bookId?: number;
  playlistId?: number;
  repeat: CretaSlotRepeat;
  repeatStart?: string | null;
  repeatEnd?: string | null;
};

/** 수정 모드 초기값(기존 시간대) — 다이얼로그는 열 때마다 새로 마운트되는 전제 */
export type CretaSlotInitial = {
  startMin: number;
  endMin: number;
  sourceType: "book" | "playlist";
  content: { id: number; title: string } | null;
  repeat: CretaSlotRepeat;
  repeatStart: string | null;
  repeatEnd: string | null;
};

const REPEAT_ORDER: CretaSlotRepeat[] = [
  "once",
  "daily",
  "weekday",
  "weekend",
  "range",
];

export function CretaSlotAddDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
  initial,
  selectedDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 유효성 통과한 시간대 초안 제출(서버에서 겹침 재검증) */
  onSubmit: (draft: CretaSlotDraft) => void;
  pending: boolean;
  /** 있으면 수정 모드로 동작 */
  initial?: CretaSlotInitial;
  /** 달력에서 고른 기준일 — "이 날짜만" 반복의 대상 날짜 */
  selectedDate?: { iso: string; label: string };
}) {
  const [start, setStart] = useState(
    initial ? minutesToTime(initial.startMin) : "09:00",
  );
  const [end, setEnd] = useState(
    initial ? minutesToTime(initial.endMin) : "10:00",
  );
  const [sourceType, setSourceType] = useState<"book" | "playlist">(
    initial?.sourceType ?? "book",
  );
  const [selectedBook, setSelectedBook] = useState<{
    id: number;
    title: string;
  } | null>(initial?.sourceType === "book" ? initial.content : null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<{
    id: number;
    title: string;
  } | null>(initial?.sourceType === "playlist" ? initial.content : null);
  const [repeat, setRepeat] = useState<CretaSlotRepeat>(
    initial?.repeat ?? "once",
  );
  const [rangeStart, setRangeStart] = useState(initial?.repeatStart ?? "");
  const [rangeEnd, setRangeEnd] = useState(initial?.repeatEnd ?? "");
  const [error, setError] = useState<string | null>(null);

  const selected = sourceType === "book" ? selectedBook : selectedPlaylist;

  const submit = () => {
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (!start || !end || startMin >= endMin) {
      setError("시작 시각은 종료 시각보다 앞서야 합니다.");
      return;
    }
    if (!selected) {
      setError(
        sourceType === "book"
          ? "재생할 크레타북을 선택해 주세요."
          : "재생할 플레이리스트를 선택해 주세요.",
      );
      return;
    }
    if (repeat === "range" && (!rangeStart || !rangeEnd)) {
      setError("기간 지정 반복은 시작일과 종료일이 필요합니다.");
      return;
    }
    setError(null);
    // "이 날짜만"은 달력 기준일을 저장해 해당 날짜에만 편성되게 한다
    const onceAnchor =
      selectedDate?.iso ??
      (initial?.repeat === "once" ? initial.repeatStart : null);
    onSubmit({
      startMin,
      endMin,
      sourceType,
      ...(sourceType === "book"
        ? { bookId: selected.id }
        : { playlistId: selected.id }),
      repeat,
      repeatStart:
        repeat === "range" ? rangeStart : repeat === "once" ? onceAnchor : null,
      repeatEnd: repeat === "range" ? rangeEnd : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "시간대 수정" : "시간대 추가"}</DialogTitle>
          <DialogDescription>
            {selectedDate ? `${selectedDate.label} · ` : ""}빈 시간에는 기본
            재생이 이어집니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="creta-slot-start">시작</Label>
              <Input
                id="creta-slot-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creta-slot-end">종료</Label>
              <Input
                id="creta-slot-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>재생 대상</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={sourceType === "book" ? "default" : "outline"}
                onClick={() => setSourceType("book")}
              >
                크레타북
              </Button>
              <Button
                type="button"
                variant={sourceType === "playlist" ? "default" : "outline"}
                onClick={() => setSourceType("playlist")}
              >
                플레이리스트
              </Button>
            </div>
            <CretaSourcePicker
              kind={sourceType}
              selectedId={selected?.id ?? null}
              onSelect={(option) =>
                sourceType === "book"
                  ? setSelectedBook(option)
                  : setSelectedPlaylist(option)
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>반복</Label>
            <div className="flex flex-wrap gap-1.5">
              {REPEAT_ORDER.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRepeat(r)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    repeat === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {SLOT_REPEAT_LABEL[r]}
                </button>
              ))}
            </div>
            {repeat === "range" ? (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="creta-slot-range-start">시작일</Label>
                  <Input
                    id="creta-slot-range-start"
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="creta-slot-range-end">종료일</Label>
                  <Input
                    id="creta-slot-range-end"
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              반복 시간대는 해당하는 모든 날짜의 타임라인에 자동 편성됩니다.
              ‘매일 (연중)’은 1년 내내 같은 시간에 재생합니다.
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {initial
              ? pending
                ? "저장 중…"
                : "저장"
              : pending
                ? "추가 중…"
                : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
