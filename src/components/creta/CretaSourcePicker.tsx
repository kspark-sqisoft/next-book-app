"use client";

// 콘텐츠 선택 리스트(북/플레이리스트/스케줄) — 시간대 추가·재생 소스 변경 등
// 다이얼로그 안에서 공용으로 사용. 북은 제목 검색을 지원.
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCircle2, Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  CretaCoverThumb,
  useCretaCoverThumbs,
} from "@/components/creta/CretaCoverThumb";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  CRETA_DEVICE_STATUS_LABEL,
  cretaDeviceStatus,
  fetchCretaDevices,
  fetchCretaPlaylists,
  fetchCretaSchedules,
} from "@/features/creta/creta-api";
import { type BookListCoverPreview, fetchBooksPage } from "@/lib/api";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export type CretaPickerKind = "book" | "playlist" | "schedule" | "device";

type PickerOption = {
  id: number;
  title: string;
  meta: string;
  cover: BookListCoverPreview | null;
};

export function CretaSourcePicker({
  kind,
  selectedId,
  onSelect,
  appliedIds,
  appliedLabel = "적용 중",
}: {
  kind: CretaPickerKind;
  selectedId: number | null;
  /** 선택 시 대상의 id·제목 전달 */
  onSelect: (option: { id: number; title: string }) => void;
  /** 이미 적용된 항목 id — 체크 배지로 표시하고 다시 고를 수 없게 함(예: 이 스케줄이 배정된 디바이스) */
  appliedIds?: readonly number[];
  appliedLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const appliedSet = useMemo(() => new Set(appliedIds ?? []), [appliedIds]);

  const booksQuery = useQuery({
    queryKey: [...cretaKeys.all, "picker", "book", search],
    queryFn: () => fetchBooksPage({ take: 30, search: search || undefined }),
    enabled: kind === "book",
  });
  const playlistsQuery = useQuery({
    queryKey: cretaKeys.playlists(),
    queryFn: fetchCretaPlaylists,
    enabled: kind === "playlist",
  });
  const schedulesQuery = useQuery({
    queryKey: cretaKeys.schedules(),
    queryFn: fetchCretaSchedules,
    enabled: kind === "schedule",
  });
  const devicesQuery = useQuery({
    queryKey: cretaKeys.devices(),
    queryFn: fetchCretaDevices,
    enabled: kind === "device",
  });

  const options: PickerOption[] = useMemo(() => {
    if (kind === "book") {
      return (booksQuery.data?.items ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        meta: `${b.pageCount}페이지 · ${b.author.name || "이름 없음"}`,
        cover: b.coverPreview,
      }));
    }
    if (kind === "playlist") {
      return (playlistsQuery.data ?? []).map((p) => ({
        id: p.id,
        title: p.name,
        meta: `크레타북 ${p.itemCount}개`,
        cover: p.cover,
      }));
    }
    if (kind === "device") {
      return (devicesQuery.data ?? []).map((d) => ({
        id: d.id,
        title: d.name,
        meta: `${d.location || "위치 미지정"} · ${d.resolution} · ${CRETA_DEVICE_STATUS_LABEL[cretaDeviceStatus(d)]}`,
        cover: d.source?.cover ?? null,
      }));
    }
    return (schedulesQuery.data ?? []).map((s) => ({
      id: s.id,
      title: s.name,
      meta: `시간대 ${s.slotCount}개`,
      cover: s.defaultContent?.cover ?? null,
    }));
  }, [
    kind,
    booksQuery.data,
    playlistsQuery.data,
    schedulesQuery.data,
    devicesQuery.data,
  ]);

  const thumbEntries = useMemo(
    () =>
      options.map((o) => ({ key: `picker-${kind}-${o.id}`, cover: o.cover })),
    [options, kind],
  );
  const thumbs = useCretaCoverThumbs(thumbEntries);

  const loading =
    (kind === "book" && booksQuery.isLoading) ||
    (kind === "playlist" && playlistsQuery.isLoading) ||
    (kind === "schedule" && schedulesQuery.isLoading) ||
    (kind === "device" && devicesQuery.isLoading);

  const emptyLabel =
    kind === "book"
      ? "북이 없습니다. 크레타 > 북에서 먼저 만들어 주세요."
      : kind === "playlist"
        ? "플레이리스트가 없습니다. 먼저 만들어 주세요."
        : kind === "device"
          ? "디바이스가 없습니다. 먼저 등록해 주세요."
          : "스케줄이 없습니다. 먼저 만들어 주세요.";

  return (
    <div className="space-y-2">
      {kind === "book" ? (
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
            placeholder="북 제목 검색…"
            className="h-9 pl-9"
            aria-label="북 검색"
          />
        </div>
      ) : null}
      <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-border p-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-5" />
          </div>
        ) : options.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          options.map((o) => {
            const applied = appliedSet.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                disabled={applied}
                aria-pressed={selectedId === o.id}
                onClick={() => onSelect({ id: o.id, title: o.title })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                  applied
                    ? "cursor-default bg-emerald-500/8"
                    : selectedId === o.id
                      ? "bg-primary/10 ring-1 ring-primary/40"
                      : "hover:bg-muted",
                )}
              >
                <CretaCoverThumb
                  dataUrl={thumbs[`picker-${kind}-${o.id}`]}
                  title={o.title}
                  className="h-9 w-14"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {o.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {o.meta}
                  </span>
                </span>
                {applied ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    {appliedLabel}
                  </span>
                ) : selectedId === o.id ? (
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
