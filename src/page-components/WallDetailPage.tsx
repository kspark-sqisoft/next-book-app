"use client";

// 비디오월 상세 — 모드(타일/동시/콘텐츠별)·격자·콘텐츠·멤버(마스터 포함) 구성과
// 동기 재생 미리보기. 실제 플레이어가 없어 공통 클록(균일 슬라이드 시간)으로
// 모든 프레임이 같은 박자에 페이지를 넘기는 시뮬레이션이다.
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Crown,
  Grid2x2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CretaSourceDialog } from "@/components/creta/CretaSourceDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
} from "@/features/book/book-canvas";
import { useBookPageThumbnails } from "@/features/book/use-book-page-thumbnails";
import {
  type CretaDevice,
  fetchCretaDevices,
} from "@/features/creta/creta-api";
import {
  CRETA_WALL_MODE_DESC,
  CRETA_WALL_MODE_LABEL,
  CRETA_WALL_MODES,
  type CretaVideoWall,
  fetchCretaWall,
  setCretaWallMembers,
  updateCretaWall,
} from "@/features/creta/creta-walls-api";
import { type BookDetail, fetchBook } from "@/lib/api";
import { goBackOrPush } from "@/lib/navigate-back";
import { bookKeys, cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

const SLIDE_SEC_OPTIONS = [3, 5, 8, 10, 15, 30];

/** 멤버 편집 드래프트 — 배열 순서 = 타일 위치 */
type MemberDraft = {
  deviceId: number;
  deviceName: string;
  online: boolean;
  isMaster: boolean;
  bookId: number | null;
  bookTitle: string | null;
};

export function WallDetailPage() {
  const params = useParams<{ id: string }>();
  const wallId = Number(params.id);
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: wall,
    isLoading,
    isError,
  } = useQuery({
    queryKey: cretaKeys.wall(wallId),
    queryFn: () => fetchCretaWall(wallId),
    enabled: Number.isFinite(wallId) && wallId > 0,
  });
  const { data: devices } = useQuery({
    queryKey: cretaKeys.devices(),
    queryFn: fetchCretaDevices,
  });

  const applyWall = (res: CretaVideoWall) => {
    queryClient.setQueryData(cretaKeys.wall(wallId), res);
    void queryClient.invalidateQueries({ queryKey: cretaKeys.walls() });
  };

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateCretaWall>[1]) =>
      updateCretaWall(wallId, input),
    onSuccess: applyWall,
    onError: (e: Error) => toast.error(e.message),
  });

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
  if (isError || !wall) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          비디오월을 찾을 수 없습니다.
        </p>
        <Button asChild variant="outline">
          <Link href="/walls">
            <ArrowLeft className="size-4" aria-hidden />
            비디오월 목록으로
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => goBackOrPush(router, "/walls")}
        className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        비디오월
      </button>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Grid2x2 className="size-5 shrink-0 text-primary" aria-hidden />
            <h1 className="font-heading text-xl font-bold">{wall.name}</h1>
            <Badge variant="secondary">
              {CRETA_WALL_MODE_LABEL[wall.mode]}
            </Badge>
            {wall.ownerName ? (
              <span className="text-xs text-muted-foreground">
                작성자{" "}
                <span className="font-medium text-foreground">
                  {wall.ownerName}
                </span>
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CRETA_WALL_MODES.map((m) => (
              <Button
                key={m}
                type="button"
                variant={wall.mode === m ? "default" : "outline"}
                disabled={updateMutation.isPending}
                onClick={() => {
                  if (!requireLogin()) return;
                  updateMutation.mutate({ mode: m });
                }}
              >
                {CRETA_WALL_MODE_LABEL[m]}
              </Button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {CRETA_WALL_MODE_DESC[wall.mode]}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {wall.mode === "tile" ? (
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                격자
                <NativeSelect
                  value={String(wall.rows)}
                  aria-label="격자 행"
                  onChange={(e) => {
                    if (!requireLogin()) return;
                    updateMutation.mutate({ rows: Number(e.target.value) });
                  }}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}행
                    </option>
                  ))}
                </NativeSelect>
                ×
                <NativeSelect
                  value={String(wall.cols)}
                  aria-label="격자 열"
                  onChange={(e) => {
                    if (!requireLogin()) return;
                    updateMutation.mutate({ cols: Number(e.target.value) });
                  }}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}열
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ) : null}
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              슬라이드
              <NativeSelect
                value={String(wall.slideSec)}
                aria-label="슬라이드 시간"
                onChange={(e) => {
                  if (!requireLogin()) return;
                  updateMutation.mutate({ slideSec: Number(e.target.value) });
                }}
              >
                {SLIDE_SEC_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}초
                  </option>
                ))}
              </NativeSelect>
            </label>
            {wall.mode !== "multi" ? (
              <WallBookPicker
                label={wall.bookTitle ?? "콘텐츠(북) 선택"}
                onPick={(bookId) => {
                  if (!requireLogin()) return;
                  updateMutation.mutate({ bookId });
                }}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <WallMembersCard
          key={`${wall.id}|${wall.updatedAt}`}
          wall={wall}
          devices={devices ?? []}
          requireLogin={requireLogin}
          onSaved={applyWall}
        />
        <WallPreview wall={wall} />
      </div>
    </div>
  );
}

/** 북 선택 버튼 + 다이얼로그(북만) */
function WallBookPicker({
  label,
  onPick,
}: {
  label: string;
  onPick: (bookId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open ? (
        <CretaSourceDialog
          open={open}
          onOpenChange={setOpen}
          title="비디오월 콘텐츠 선택"
          description="모든 멤버 디바이스가 이 북을 함께 재생합니다."
          kinds={["book"]}
          pending={false}
          onSubmit={(_kind, option) => {
            onPick(option.id);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** 멤버 구성 — 체크로 추가/제거, 순서(타일 위치)·마스터·(multi) 북 지정 후 저장 */
function WallMembersCard({
  wall,
  devices,
  requireLogin,
  onSaved,
}: {
  wall: CretaVideoWall;
  devices: CretaDevice[];
  requireLogin: () => boolean;
  onSaved: (wall: CretaVideoWall) => void;
}) {
  const [members, setMembers] = useState<MemberDraft[]>(() =>
    wall.members.map((m) => ({
      deviceId: m.deviceId,
      deviceName: m.deviceName,
      online: m.online,
      isMaster: m.isMaster,
      bookId: m.bookId,
      bookTitle: m.bookTitle,
    })),
  );
  const [bookPickFor, setBookPickFor] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      setCretaWallMembers(
        wall.id,
        members.map((m) => ({
          deviceId: m.deviceId,
          isMaster: m.isMaster,
          bookId: m.bookId,
        })),
      ),
    onSuccess: (res) => {
      onSaved(res);
      toast.success("멤버 구성을 저장했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDevice = (d: CretaDevice) => {
    setMembers((prev) => {
      const idx = prev.findIndex((m) => m.deviceId === d.id);
      if (idx >= 0) {
        const next = prev.filter((m) => m.deviceId !== d.id);
        // 마스터가 빠지면 첫 멤버를 마스터로
        if (prev[idx].isMaster && next.length > 0) next[0].isMaster = true;
        return [...next];
      }
      return [
        ...prev,
        {
          deviceId: d.id,
          deviceName: d.name,
          online: d.online,
          isMaster: prev.length === 0,
          bookId: null,
          bookTitle: null,
        },
      ];
    });
  };
  const move = (deviceId: number, dir: -1 | 1) => {
    setMembers((prev) => {
      const idx = prev.findIndex((m) => m.deviceId === deviceId);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };
  const setMaster = (deviceId: number) =>
    setMembers((prev) =>
      prev.map((m) => ({ ...m, isMaster: m.deviceId === deviceId })),
    );

  const memberIds = new Set(members.map((m) => m.deviceId));
  const dirty =
    members.length !== wall.members.length ||
    members.some(
      (m, i) =>
        wall.members[i]?.deviceId !== m.deviceId ||
        wall.members[i]?.isMaster !== m.isMaster ||
        (wall.members[i]?.bookId ?? null) !== m.bookId,
    );

  return (
    <Card className="h-fit">
      <CardContent className="space-y-3">
        <p className="text-sm font-semibold">
          멤버 구성
          <span className="ml-1 font-normal text-muted-foreground">
            ({members.length}대)
          </span>
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          체크로 디바이스를 추가하고, 순서(타일 위치)·마스터를 정하세요.
          {wall.mode === "multi" ? " 멤버마다 재생할 북을 고릅니다." : ""}
        </p>
        {/* 선택된 멤버(순서 = 타일 위치) */}
        {members.length > 0 ? (
          <div className="space-y-1 rounded-md border border-border p-1.5">
            {members.map((m, i) => (
              <div
                key={m.deviceId}
                className="flex items-center gap-1.5 rounded px-1.5 py-1 text-sm hover:bg-muted/50"
              >
                <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <button
                  type="button"
                  title={m.isMaster ? "마스터 디바이스" : "마스터로 지정"}
                  aria-label={`${m.deviceName} 마스터로 지정`}
                  className={cn(
                    "shrink-0 rounded p-0.5",
                    m.isMaster
                      ? "text-amber-500"
                      : "text-muted-foreground/40 hover:text-amber-500",
                  )}
                  onClick={() => setMaster(m.deviceId)}
                >
                  <Crown className="size-3.5" aria-hidden />
                </button>
                <span className="min-w-0 flex-1 truncate">
                  {m.deviceName}
                  {!m.online ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (오프라인)
                    </span>
                  ) : null}
                </span>
                {wall.mode === "multi" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 max-w-28 shrink-0 truncate px-1.5 text-[11px]"
                    onClick={() => setBookPickFor(m.deviceId)}
                  >
                    {m.bookTitle ?? "북 선택"}
                  </Button>
                ) : null}
                <button
                  type="button"
                  aria-label="위로"
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(m.deviceId, -1)}
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="아래로"
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === members.length - 1}
                  onClick={() => move(m.deviceId, 1)}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {/* 추가 가능한 디바이스 */}
        <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
          {devices.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              등록된 디바이스가 없습니다.
            </p>
          ) : (
            devices.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={memberIds.has(d.id)}
                  onCheckedChange={() => toggleDevice(d)}
                  aria-label={`${d.name} 멤버 선택`}
                />
                <span className="min-w-0 flex-1 truncate">
                  {d.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {d.location || ""}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => {
            if (!requireLogin()) return;
            saveMutation.mutate();
          }}
        >
          {saveMutation.isPending ? "저장 중…" : "멤버 저장"}
        </Button>
      </CardContent>

      {bookPickFor != null ? (
        <CretaSourceDialog
          open
          onOpenChange={(o) => {
            if (!o) setBookPickFor(null);
          }}
          title="이 디바이스가 재생할 북"
          description="콘텐츠별 모드 — 페이지 전환 타이밍은 월 전체가 함께 맞춥니다."
          kinds={["book"]}
          pending={false}
          onSubmit={(_kind, option) => {
            setMembers((prev) =>
              prev.map((m) =>
                m.deviceId === bookPickFor
                  ? { ...m, bookId: option.id, bookTitle: option.title }
                  : m,
              ),
            );
            setBookPickFor(null);
          }}
        />
      ) : null}
    </Card>
  );
}

/** 동기 재생 미리보기 — 공통 클록으로 모든 프레임이 같은 박자에 페이지를 넘긴다 */
function WallPreview({ wall }: { wall: CretaVideoWall }) {
  // 필요한 북 로드(tile·mirror: 월 공통 북 / multi: 멤버별 북)
  const bookIds = useMemo(() => {
    if (wall.mode === "multi") {
      return [
        ...new Set(
          wall.members
            .map((m) => m.bookId)
            .filter((n): n is number => n != null),
        ),
      ];
    }
    return wall.bookId != null ? [wall.bookId] : [];
  }, [wall]);
  const bookQueries = useQueries({
    queries: bookIds.map((id) => ({
      queryKey: bookKeys.detail(id),
      queryFn: () => fetchBook(id),
      staleTime: 30_000,
    })),
  });
  const booksById = useMemo(() => {
    const map = new Map<number, BookDetail>();
    bookIds.forEach((id, i) => {
      const data = bookQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- data 배열만 의존
  }, [bookIds, ...bookQueries.map((q) => q.data)]);

  // 페이지 썸네일(정지 화면) — 타일 분할은 이미지 background-position으로 조각을 보여준다
  const thumbSources = useMemo(() => {
    const out: {
      clientKey: string;
      backgroundColor: string;
      elements: BookDetail["pages"][number]["elements"];
      slideWidth?: number;
      slideHeight?: number;
    }[] = [];
    for (const [id, book] of booksById) {
      const pages = [...(book.pages ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      for (const p of pages) {
        out.push({
          clientKey: `wall-${id}-${p.id}`,
          backgroundColor:
            typeof p.backgroundColor === "string" && p.backgroundColor.trim()
              ? p.backgroundColor.trim()
              : DEFAULT_PAGE_BACKGROUND,
          elements: p.elements,
          slideWidth: book.slideWidth,
          slideHeight: book.slideHeight,
        });
      }
    }
    return out;
  }, [booksById]);
  const thumbs = useBookPageThumbnails(
    thumbSources,
    DEFAULT_SLIDE_WIDTH,
    DEFAULT_SLIDE_HEIGHT,
  );

  // 공통 클록 — Date.now()/slideSec 기반이라 여러 창을 띄워도 같은 박자로 돈다
  const slideMs = Math.max(3, wall.slideSec) * 1000;
  const [now, setNow] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const [frozenIndex, setFrozenIndex] = useState(0);
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setNow(Date.now()), 300);
    return () => window.clearInterval(t);
  }, [paused]);
  const baseIndex = Math.floor(now / slideMs) + offset;
  const index = paused ? frozenIndex : baseIndex;

  const togglePause = () => {
    if (paused) {
      setOffset(frozenIndex - Math.floor(Date.now() / slideMs));
      setNow(Date.now());
      setPaused(false);
    } else {
      setFrozenIndex(baseIndex);
      setPaused(true);
    }
  };
  const step = (dir: -1 | 1) => {
    if (paused) setFrozenIndex((i) => i + dir);
    else setOffset((o) => o + dir);
  };

  const pageThumbFor = (
    bookId: number | null,
  ): { url: string | null; page: number; total: number } => {
    if (bookId == null) return { url: null, page: 0, total: 0 };
    const book = booksById.get(bookId);
    const pages = book
      ? [...(book.pages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
    if (pages.length === 0) return { url: null, page: 0, total: 0 };
    const i = ((index % pages.length) + pages.length) % pages.length;
    return {
      url: thumbs[`wall-${bookId}-${pages[i].id}`] ?? null,
      page: i + 1,
      total: pages.length,
    };
  };

  const masterId = wall.members.find((m) => m.isMaster)?.deviceId;
  const gridCols =
    wall.mode === "tile"
      ? wall.cols
      : Math.min(
          3,
          Math.max(1, Math.ceil(Math.sqrt(wall.members.length || 1))),
        );

  // tile 모드: rows×cols 슬롯(멤버 순서 = 행 우선), 그 외: 멤버 수만큼
  const slots =
    wall.mode === "tile"
      ? Array.from({ length: wall.rows * wall.cols }, (_, i) => ({
          member: wall.members[i] ?? null,
          tile: { row: Math.floor(i / wall.cols), col: i % wall.cols },
        }))
      : wall.members.map((m) => ({ member: m, tile: null }));

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            동기 재생 미리보기
            <span className="ml-1 font-normal text-muted-foreground">
              — 모든 디바이스가 같은 박자로 넘어갑니다
            </span>
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="이전 페이지(전체 동기)"
              onClick={() => step(-1)}
            >
              <SkipBack className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              aria-pressed={paused}
              onClick={togglePause}
            >
              {paused ? (
                <>
                  <Play className="mr-1 size-3.5" aria-hidden />
                  재생
                </>
              ) : (
                <>
                  <Pause className="mr-1 size-3.5" aria-hidden />
                  일시정지
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="다음 페이지(전체 동기)"
              onClick={() => step(1)}
            >
              <SkipForward className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
        {wall.members.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            왼쪽에서 멤버 디바이스를 추가하면 미리보기가 나타납니다.
          </p>
        ) : wall.mode !== "multi" && wall.bookId == null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            위에서 콘텐츠(북)를 선택하세요.
          </p>
        ) : (
          <div
            className="grid gap-1.5 rounded-lg bg-zinc-950 p-2"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            }}
            data-testid="wall-preview-grid"
          >
            {slots.map((slot, i) => {
              const m = slot.member;
              const bookId =
                wall.mode === "multi" ? (m?.bookId ?? null) : wall.bookId;
              const thumb = pageThumbFor(bookId);
              return (
                <div
                  key={m ? m.deviceId : `empty-${i}`}
                  className="relative aspect-video overflow-hidden rounded-md border-2 border-zinc-700 bg-black"
                >
                  {!m ? (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600">
                      미배정
                    </span>
                  ) : !m.online ? (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
                      오프라인
                    </span>
                  ) : thumb.url == null ? (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
                      {wall.mode === "multi" ? "북 미지정" : "렌더 중…"}
                    </span>
                  ) : slot.tile ? (
                    /* 타일 분할 — 페이지 이미지를 격자만큼 확대해 자기 조각만 표시 */
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${thumb.url})`,
                        backgroundSize: `${wall.cols * 100}% ${wall.rows * 100}%`,
                        backgroundPosition: `${
                          wall.cols > 1
                            ? (slot.tile.col / (wall.cols - 1)) * 100
                            : 0
                        }% ${
                          wall.rows > 1
                            ? (slot.tile.row / (wall.rows - 1)) * 100
                            : 0
                        }%`,
                      }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- 데이터 URL 썸네일
                    <img
                      src={thumb.url}
                      alt=""
                      className="absolute inset-0 size-full object-fill"
                      draggable={false}
                    />
                  )}
                  {m ? (
                    <>
                      {m.deviceId === masterId ? (
                        <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-bold text-black">
                          <Crown className="size-2.5" aria-hidden />
                          MASTER
                        </span>
                      ) : null}
                      <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1.5 py-0.5">
                        <span className="truncate text-[10px] text-zinc-200">
                          {m.deviceName}
                        </span>
                        {m.online && thumb.total > 0 ? (
                          <span className="shrink-0 text-[9px] tabular-nums text-zinc-400">
                            {thumb.page}/{thumb.total}
                          </span>
                        ) : null}
                      </span>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          공통 클록(슬라이드 {wall.slideSec}초) 기반 동기 — 마스터(
          <Crown className="inline size-3 text-amber-500" aria-hidden />) 기준
          제어를 시뮬레이션합니다. 일시정지·이전/다음은 월 전체에 함께
          적용됩니다.
        </p>
      </CardContent>
    </Card>
  );
}
