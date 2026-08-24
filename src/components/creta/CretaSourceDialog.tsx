"use client";

// 콘텐츠 선택 다이얼로그 — 디바이스 재생 소스 변경, 스케줄 기본 재생 지정 등
// "타입(선택) → 목록에서 항목 선택" 흐름을 공용화.
import { useState } from "react";

import {
  type CretaPickerKind,
  CretaSourcePicker,
} from "@/components/creta/CretaSourcePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const KIND_LABEL: Record<CretaPickerKind, string> = {
  book: "크레타북",
  playlist: "플레이리스트",
  schedule: "스케줄",
  device: "디바이스",
};

export function CretaSourceDialog({
  open,
  onOpenChange,
  title,
  description,
  kinds,
  initialKind,
  onSubmit,
  pending,
  clearLabel,
  onClear,
  appliedIds,
  appliedLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** 고를 수 있는 콘텐츠 타입(2개 이상이면 토글 표시) */
  kinds: CretaPickerKind[];
  initialKind?: CretaPickerKind;
  onSubmit: (
    kind: CretaPickerKind,
    option: { id: number; title: string },
  ) => void;
  pending: boolean;
  /** 지정 해제 버튼(예: "기본 재생 없음") — 없으면 숨김 */
  clearLabel?: string;
  onClear?: () => void;
  /** 이미 적용된 항목 id — 목록에서 체크 배지로 표시(예: 이 스케줄이 배정된 디바이스) */
  appliedIds?: readonly number[];
  appliedLabel?: string;
}) {
  const [kind, setKind] = useState<CretaPickerKind>(
    initialKind ?? kinds[0] ?? "book",
  );
  const [selected, setSelected] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const activeKind = kinds.includes(kind) ? kind : (kinds[0] ?? "book");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-3">
          {kinds.length > 1 ? (
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${kinds.length}, minmax(0,1fr))`,
              }}
            >
              {kinds.map((k) => (
                <Button
                  key={k}
                  type="button"
                  variant={activeKind === k ? "default" : "outline"}
                  onClick={() => {
                    setKind(k);
                    setSelected(null);
                  }}
                >
                  {KIND_LABEL[k]}
                </Button>
              ))}
            </div>
          ) : null}
          <CretaSourcePicker
            kind={activeKind}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            appliedIds={appliedIds}
            appliedLabel={appliedLabel}
          />
        </div>

        <DialogFooter>
          {clearLabel && onClear ? (
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto"
              disabled={pending}
              onClick={onClear}
            >
              {clearLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            disabled={pending || !selected}
            onClick={() => selected && onSubmit(activeKind, selected)}
          >
            {pending ? "적용 중…" : "선택"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
