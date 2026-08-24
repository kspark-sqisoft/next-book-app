import { CalendarOff, Clock, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  type CretaDevicePowerInput,
  WEEKDAY_SHORT_LABEL,
} from "@/lib/creta-api";
import { cn } from "@/lib/utils";

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXCLUDE_DATES_MAX = 60;

type Props = {
  powerOnTime: string | null;
  powerOffTime: string | null;
  powerExcludeDays: number[];
  powerExcludeDates: string[];
  pending: boolean;
  onSave: (next: CretaDevicePowerInput) => void;
  /** 로그인 등 선행 조건 확인. false면 저장하지 않음 */
  canEdit: () => boolean;
};

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function sameStrings(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** "YYYY-MM-DD" → "M/D (요일)" */
function formatDateChip(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return `${m}/${d} (${WEEKDAY_SHORT_LABEL[dt.getDay()]})`;
}

/**
 * 디바이스 전원 예약(매일 켜짐/꺼짐 시각 + 제외 요일·제외 날짜). 저장 시점에 서버에 반영.
 * 서버 값이 바뀌면 부모가 key를 바꿔 다시 마운트하므로 내부 상태는 초기값만 받는다.
 */
export function DevicePowerScheduleCard({
  powerOnTime,
  powerOffTime,
  powerExcludeDays,
  powerExcludeDates,
  pending,
  onSave,
  canEdit,
}: Props) {
  const [on, setOn] = useState(powerOnTime ?? "");
  const [off, setOff] = useState(powerOffTime ?? "");
  const [days, setDays] = useState<number[]>(powerExcludeDays);
  const [dates, setDates] = useState<string[]>(powerExcludeDates);
  const [dateDraft, setDateDraft] = useState("");

  const onValid = on === "" || HHMM_RE.test(on);
  const offValid = off === "" || HHMM_RE.test(off);
  const same = on !== "" && on === off;
  const allDaysExcluded = days.length >= 7;
  const dirty =
    on !== (powerOnTime ?? "") ||
    off !== (powerOffTime ?? "") ||
    !sameNumbers(days, powerExcludeDays) ||
    !sameStrings(dates, powerExcludeDates);
  const canSave =
    dirty && onValid && offValid && !same && !allDaysExcluded && !pending;
  const hasSchedule = Boolean(powerOnTime || powerOffTime);
  const cleared =
    on === "" && off === "" && days.length === 0 && dates.length === 0;

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d)
        ? prev.filter((x) => x !== d)
        : [...prev, d].sort((a, b) => a - b),
    );
  const addDate = () => {
    const v = dateDraft.trim();
    if (
      !YMD_RE.test(v) ||
      dates.includes(v) ||
      dates.length >= EXCLUDE_DATES_MAX
    )
      return;
    setDates((prev) => [...prev, v].sort());
    setDateDraft("");
  };

  const summary = hasSchedule
    ? [
        `매일 ${powerOnTime ? `${powerOnTime} 켜짐` : "켜짐 없음"} · ${powerOffTime ? `${powerOffTime} 꺼짐` : "꺼짐 없음"}`,
        powerExcludeDays.length
          ? `${powerExcludeDays.map((d) => WEEKDAY_SHORT_LABEL[d]).join("·")}요일 제외`
          : null,
        powerExcludeDates.length
          ? `특정일 ${powerExcludeDates.length}일 제외`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">전원 예약</p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          매일 정해진 시각에 켜지고 꺼지도록 예약합니다. 예: 아침 09:00 켜짐,
          저녁 18:00 꺼짐. 제외한 요일·날짜에는 예약이 실행되지 않습니다.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="device-power-on" className="text-[11px]">
              켜짐 시각
            </Label>
            <Input
              id="device-power-on"
              type="time"
              step={60}
              value={on}
              onChange={(e) => setOn(e.target.value)}
              aria-invalid={!onValid || same}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="device-power-off" className="text-[11px]">
              꺼짐 시각
            </Label>
            <Input
              id="device-power-off"
              type="time"
              step={60}
              value={off}
              onChange={(e) => setOff(e.target.value)}
              aria-invalid={!offValid || same}
            />
          </div>
        </div>

        {/* 제외 요일 */}
        <div className="space-y-1">
          <Label className="text-[11px]">제외 요일</Label>
          <div
            className="grid grid-cols-7 gap-1"
            role="group"
            aria-label="전원 예약 제외 요일"
          >
            {WEEKDAY_SHORT_LABEL.map((label, d) => {
              const excluded = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={excluded}
                  aria-label={`${label}요일 ${excluded ? "제외됨" : "포함"}`}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "h-8 rounded-md border text-xs font-medium transition-colors",
                    excluded
                      ? "border-transparent bg-muted-foreground/15 text-muted-foreground line-through"
                      : "border-border bg-background hover:bg-muted",
                    d === 0 && !excluded && "text-red-600 dark:text-red-400",
                    d === 6 && !excluded && "text-blue-600 dark:text-blue-400",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {allDaysExcluded
              ? "모든 요일을 제외할 수는 없습니다."
              : days.length
                ? `${days.map((d) => WEEKDAY_SHORT_LABEL[d]).join("·")}요일에는 예약이 실행되지 않습니다.`
                : "누르면 그 요일을 제외합니다."}
          </p>
        </div>

        {/* 제외 날짜 */}
        <div className="space-y-1">
          <Label htmlFor="device-power-exclude-date" className="text-[11px]">
            특정일 제외 (공휴일·점검일 등)
          </Label>
          <div className="flex gap-1.5">
            <Input
              id="device-power-exclude-date"
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDate();
                }
              }}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={
                !YMD_RE.test(dateDraft) ||
                dates.includes(dateDraft) ||
                dates.length >= EXCLUDE_DATES_MAX
              }
              onClick={addDate}
            >
              추가
            </Button>
          </div>
          {dates.length ? (
            <ul className="flex flex-wrap gap-1" aria-label="제외 날짜 목록">
              {dates.map((d) => (
                <li
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-2 pr-1 text-[11px] tabular-nums"
                  title={d}
                >
                  <CalendarOff
                    className="size-3 text-muted-foreground"
                    aria-hidden
                  />
                  {formatDateChip(d)}
                  <button
                    type="button"
                    aria-label={`${d} 제외 해제`}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() =>
                      setDates((prev) => prev.filter((x) => x !== d))
                    }
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              제외할 날짜가 없습니다. 날짜를 고르고 ‘추가’를 누르세요.
            </p>
          )}
        </div>

        {same ? (
          <p className="text-[11px] text-destructive">
            켜짐 시각과 꺼짐 시각이 같을 수 없습니다.
          </p>
        ) : summary ? (
          <p className="text-[11px] text-muted-foreground">
            현재 예약: {summary}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            예약 없음 — 수동으로만 켜고 끕니다.
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || (!hasSchedule && cleared)}
            onClick={() => {
              if (!canEdit()) return;
              setOn("");
              setOff("");
              setDays([]);
              setDates([]);
              if (
                hasSchedule ||
                powerExcludeDays.length ||
                powerExcludeDates.length
              )
                onSave({
                  powerOnTime: null,
                  powerOffTime: null,
                  powerExcludeDays: [],
                  powerExcludeDates: [],
                });
            }}
          >
            예약 해제
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSave}
            onClick={() => {
              if (!canEdit()) return;
              onSave({
                powerOnTime: on || null,
                powerOffTime: off || null,
                powerExcludeDays: days,
                powerExcludeDates: dates,
              });
            }}
          >
            {pending ? <Spinner className="mr-1.5 size-4" aria-hidden /> : null}
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
