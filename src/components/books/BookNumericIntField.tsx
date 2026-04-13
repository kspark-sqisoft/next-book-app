"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type BookNumericIntFieldBase = {
  /** `key` 대용 — 값 변경 시 remount 방지 (`\`${elementId}:${htmlId}\`` 권장) */
  fieldKey: string;
  htmlId: string;
  label?: ReactNode;
  /** true면 Label 미렌더(바깥에 Label 둔 경우) */
  hideLabel?: boolean;
  min: number;
  max: number;
  /** 키보드·스피너 한 스텝(기본 1) */
  step?: number;
  maxDigits?: number;
  /** 음수 허용(회전 각도 등). draft 필터·자리수에 반영 */
  allowNegative?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  title?: string;
  className?: string;
  inputClassName?: string;
  helperBelow?: ReactNode;
  /** false면 ↑↓만(좁은 툴바·레이어 셀) */
  showSpinners?: boolean;
  /**
   * `clamp`(기본): blur·스텝 시 min~max로 맞춤.
   * `reject`: 범위 밖·형식 오류면 부모는 그대로 두고 draft만 이전 표시로 되돌림(뉴스 간격 등).
   */
  commitPolicy?: "clamp" | "reject";
};

export type BookNumericIntFieldProps = BookNumericIntFieldBase &
  (
    | {
        optional?: false;
        value: number;
        onCommit: (n: number) => void;
      }
    | {
        optional: true;
        value: number | undefined;
        onCommit: (n: number | undefined) => void;
      }
  );

function BookNumericIntFieldInner(props: BookNumericIntFieldProps) {
  const {
    htmlId,
    label,
    hideLabel,
    min,
    max,
    step = 1,
    maxDigits = 5,
    allowNegative = false,
    placeholder,
    "aria-label": ariaLabel,
    title,
    className,
    inputClassName,
    helperBelow,
    showSpinners = true,
    commitPolicy = "clamp",
  } = props;

  const optional = props.optional === true;

  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  const displayFromProps = (): string => {
    if (optional) {
      const v = props.value;
      return v != null && Number.isFinite(v) && Number.isInteger(v)
        ? String(v)
        : "";
    }
    return String(Math.round(props.value));
  };

  const shown = focused ? draft : displayFromProps();

  const maxChars = allowNegative ? maxDigits + 1 : maxDigits;

  const sanitize = (raw: string) => {
    if (!allowNegative) {
      return raw.replace(/\D/g, "").slice(0, maxDigits);
    }
    let t = raw.replace(/[^\d-]/g, "");
    const lead = t.startsWith("-");
    t = t.replace(/-/g, "");
    t = t.slice(0, maxDigits);
    return lead ? `-${t}` : t;
  };

  const parseDraftInt = (text: string): number | null => {
    if (text.trim() === "") return null;
    const n = Number(text);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    return n;
  };

  const getNumericBase = (): number => {
    const parsed = parseDraftInt(focused ? draft : displayFromProps());
    if (parsed != null) return parsed;
    if (optional) {
      const v = props.value;
      if (v != null && Number.isFinite(v) && Number.isInteger(v)) return v;
      return min;
    }
    return Math.round((props as { value: number }).value);
  };

  const resetDraftFromValue = () => {
    setDraft(displayFromProps());
  };

  const commit = () => {
    const text = focused ? draft : displayFromProps();
    if (text.trim() === "") {
      if (optional) {
        props.onCommit(undefined);
        setDraft("");
        return;
      }
      setDraft(displayFromProps());
      return;
    }
    const n = parseDraftInt(text);
    if (n == null) {
      resetDraftFromValue();
      return;
    }
    if (commitPolicy === "reject" && (n < min || n > max)) {
      resetDraftFromValue();
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    if (optional) {
      props.onCommit(clamped);
    } else {
      (props.onCommit as (x: number) => void)(clamped);
    }
    setDraft(String(clamped));
  };

  const stepFromArrow = (dir: 1 | -1) => {
    const base = getNumericBase();
    const next = Math.min(max, Math.max(min, base + dir * step));
    if (optional) {
      props.onCommit(next);
    } else {
      (props.onCommit as (x: number) => void)(next);
    }
    setDraft(String(next));
  };

  const baseForLimits = getNumericBase();
  const atMax = baseForLimits + step > max;
  const atMin = baseForLimits - step < min;

  const labelForSpinner =
    typeof label === "string" ? label : "숫자";

  return (
    <div className={cn("space-y-1", className)}>
      {!hideLabel && label != null ? (
        <Label htmlFor={htmlId}>{label}</Label>
      ) : null}
      <div className="group relative">
        <Input
          id={htmlId}
          type="text"
          inputMode={allowNegative ? "text" : "numeric"}
          autoComplete="off"
          placeholder={placeholder}
          aria-label={ariaLabel}
          title={title}
          className={cn(
            "font-mono tabular-nums",
            showSpinners && "pe-8",
            inputClassName,
          )}
          value={shown}
          onFocus={() => {
            setFocused(true);
            setDraft(displayFromProps());
          }}
          onChange={(e) =>
            setDraft(sanitize(e.target.value).slice(0, maxChars))
          }
          onBlur={() => {
            commit();
            setFocused(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.currentTarget as HTMLInputElement).blur();
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              stepFromArrow(1);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              stepFromArrow(-1);
            }
          }}
        />
        {showSpinners ? (
          <div
            className={cn(
              "absolute inset-y-px end-px flex w-6 flex-col pe-0.5 transition-opacity",
              "opacity-0 pointer-events-none",
              "group-hover:opacity-100 group-hover:pointer-events-auto",
              "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
            )}
          >
            <button
              type="button"
              tabIndex={-1}
              disabled={atMax}
              className={cn(
                "box-border flex h-1/2 min-h-0 w-full flex-none cursor-pointer items-center justify-center",
                "border-0 bg-transparent px-0 pb-0 pt-1 leading-none outline-none",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                "disabled:pointer-events-none disabled:opacity-30",
                "focus-visible:ring-0",
              )}
              aria-label={`${labelForSpinner} 한 단계 늘리기`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => stepFromArrow(1)}
            >
              <ChevronUp
                className="pointer-events-none block size-3 shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled={atMin}
              className={cn(
                "box-border flex h-1/2 min-h-0 w-full flex-none cursor-pointer items-center justify-center",
                "border-0 bg-transparent p-0 leading-none outline-none",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                "disabled:pointer-events-none disabled:opacity-30",
                "focus-visible:ring-0",
              )}
              aria-label={`${labelForSpinner} 한 단계 줄이기`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => stepFromArrow(-1)}
            >
              <ChevronDown
                className="pointer-events-none block size-3 shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
            </button>
          </div>
        ) : null}
      </div>
      {helperBelow}
    </div>
  );
}

export function BookNumericIntField(props: BookNumericIntFieldProps) {
  return <BookNumericIntFieldInner key={props.fieldKey} {...props} />;
}
