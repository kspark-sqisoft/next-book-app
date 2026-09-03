"use client";

// 디바이스 목록: DB 기반 등록·삭제. 행 썸네일은 현재 재생 소스(북/플레이리스트
// 첫 북/스케줄 기본 재생)의 커버를 사용한다.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, RotateCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CretaAlertBanner,
  CretaAlertOverlay,
  CretaAlertSendButton,
  useActiveCretaAlert,
} from "@/components/creta/CretaAlertControls";
import {
  CretaCoverThumb,
  useCretaCoverThumbs,
} from "@/components/creta/CretaCoverThumb";
import {
  CretaListSearch,
  matchesCretaSearch,
  normalizeCretaSearch,
} from "@/components/creta/CretaListSearch";
import {
  CretaEmptyStateIcon,
  CretaSectionIcon,
} from "@/components/creta/CretaSectionIcon";
import {
  CretaViewToggle,
  useCretaListView,
} from "@/components/creta/CretaViewToggle";
import { DeviceStatusBadge } from "@/components/creta/DeviceStatusBadge";
import { DeviceTagDeployButton } from "@/components/creta/DeviceTagDeployButton";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { cretaAlertCoversDevice } from "@/features/creta/creta-alerts-api";
import {
  createCretaDevice,
  type CretaDevice,
  cretaDeviceStatus,
  deleteCretaDevice,
  fetchCretaDevices,
  PLAY_SOURCE_LABEL,
} from "@/features/creta/creta-api";
import { isAdminUser } from "@/lib/authz";
import { GRID_CARD_HOVER, LIST_ROW_INSIDE_CARD_HOVER } from "@/lib/card-hover";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

export function DeviceListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    location: "",
    platform: "Windows",
    resolution: "1920×1080",
    orientation: "가로",
  });
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const { data: devices, isLoading } = useQuery({
    queryKey: cretaKeys.devices(),
    queryFn: fetchCretaDevices,
  });
  /** 활성 긴급 알림 — 대상 디바이스의 재생 표시를 덮는다 */
  const { data: activeAlert } = useActiveCretaAlert();

  const createMutation = useMutation({
    mutationFn: () => createCretaDevice(form),
    onSuccess: (device) => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.devices() });
      queryClient.setQueryData(cretaKeys.device(device.id), device);
      setCreateOpen(false);
      setForm({
        name: "",
        location: "",
        platform: "Windows",
        resolution: "1920×1080",
        orientation: "가로",
      });
      toast.success(`「${device.name}」을(를) 등록했습니다.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCretaDevice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.all });
      toast.success("디바이스를 삭제했습니다.");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** 태그 필터("" = 전체) — 목록 위 셀렉트에서 선택 */
  const [tagFilter, setTagFilter] = useState("");
  const [search, setSearch] = useState("");
  /** 상태 필터("" = 전체) — 위 요약 카드를 눌러 전환 */
  const [statusFilter, setStatusFilter] = useState<
    "" | "online" | "error" | "offline"
  >("");
  /** 정렬 — 상태(문제 우선/온라인 우선)로도 정렬 가능 */
  const [sortKey, setSortKey] = useState<
    "default" | "name" | "problem" | "online"
  >("default");
  /** 보기 형태 — localStorage에 기억(공용 훅) */
  const [view, changeView] = useCretaListView("creta-device-view");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const d of devices ?? []) for (const t of d.tags) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [devices]);
  const allList: CretaDevice[] = useMemo(() => devices ?? [], [devices]);
  const query = normalizeCretaSearch(search);
  const list: CretaDevice[] = useMemo(() => {
    let next = query
      ? allList.filter((d) =>
          matchesCretaSearch(query, d.name, d.location, d.tags.join(" ")),
        )
      : allList;
    if (tagFilter) next = next.filter((d) => d.tags.includes(tagFilter));
    if (statusFilter) {
      next = next.filter((d) => cretaDeviceStatus(d) === statusFilter);
    }
    if (sortKey !== "default") {
      // 문제 우선: 비정상 → 오프라인 → 온라인(운영자가 문제 단말부터 보게)
      const problemRank = { error: 0, offline: 1, online: 2 } as const;
      const onlineRank = { online: 0, error: 1, offline: 2 } as const;
      next = [...next].sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name, "ko");
        const sa = cretaDeviceStatus(a);
        const sb = cretaDeviceStatus(b);
        const rank = sortKey === "problem" ? problemRank : onlineRank;
        return rank[sa] - rank[sb] || a.name.localeCompare(b.name, "ko");
      });
    }
    return next;
  }, [allList, query, tagFilter, statusFilter, sortKey]);
  const onlineCount = allList.filter(
    (d) => cretaDeviceStatus(d) === "online",
  ).length;
  const errorCount = allList.filter(
    (d) => cretaDeviceStatus(d) === "error",
  ).length;
  const offlineCount = allList.filter(
    (d) => cretaDeviceStatus(d) === "offline",
  ).length;
  const stats: {
    label: string;
    value: number;
    dot: "ok" | "error" | null;
    filter: "" | "online" | "error" | "offline";
  }[] = [
    { label: "전체 디바이스", value: allList.length, dot: null, filter: "" },
    { label: "온라인", value: onlineCount, dot: "ok", filter: "online" },
    { label: "비정상", value: errorCount, dot: "error", filter: "error" },
    { label: "오프라인", value: offlineCount, dot: null, filter: "offline" },
  ];

  const thumbEntries = useMemo(
    () =>
      list.map((d) => ({
        key: `device-${d.id}`,
        cover: d.source?.cover ?? null,
      })),
    [list],
  );
  const thumbs = useCretaCoverThumbs(thumbEntries);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold">
          <CretaSectionIcon section="devices" className="size-6" />
          디바이스
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          사이니지 원격 재생 및 상태 관리
        </p>
      </div>

      {activeAlert ? <CretaAlertBanner alert={activeAlert} /> : null}

      {/* 요약 카드 = 상태 필터 — 누르면 아래 목록이 해당 상태만 보인다 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const active = statusFilter === stat.filter;
          return (
            <button
              key={stat.label}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(stat.filter)}
              className="text-left outline-none"
            >
              <Card
                className={cn(
                  "py-4 transition-colors hover:border-primary/40",
                  active &&
                    "border-primary/60 bg-primary/5 ring-1 ring-primary/40",
                )}
              >
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                    {stat.value}
                    {stat.dot === "ok" ? (
                      <span
                        className="size-2 rounded-full bg-emerald-500"
                        aria-hidden
                      />
                    ) : stat.dot === "error" ? (
                      <span
                        className="size-2 animate-pulse rounded-full bg-red-500"
                        aria-hidden
                      />
                    ) : null}
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <CretaListSearch
        value={search}
        onChange={setSearch}
        placeholder="디바이스 이름·위치·태그 검색…"
        label="디바이스 검색"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            디바이스 목록
          </p>
          {allTags.length > 0 ? (
            <NativeSelect
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label="태그 필터"
              className="h-8 w-auto text-xs"
            >
              <option value="">전체 태그</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <NativeSelect
            value={sortKey}
            onChange={(e) =>
              setSortKey(
                e.target.value as "default" | "name" | "problem" | "online",
              )
            }
            aria-label="정렬"
            className="h-8 w-auto text-xs"
          >
            <option value="default">등록순</option>
            <option value="name">이름순</option>
            <option value="problem">상태: 문제 우선</option>
            <option value="online">상태: 온라인 우선</option>
          </NativeSelect>
          {/* 보기 전환 — 리스트/그리드 */}
          <CretaViewToggle view={view} onChange={changeView} />
        </div>
        <div className="flex items-center gap-2">
          <DeviceTagDeployButton devices={allList} />
          <CretaAlertSendButton
            devices={allList.map((d) => ({
              id: d.id,
              name: d.name,
              location: d.location,
            }))}
          />
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
            <Plus className="size-4" aria-hidden />
            디바이스 등록
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <CretaEmptyStateIcon section="devices" />
            {query
              ? `“${search.trim()}”와 맞는 디바이스가 없습니다.`
              : statusFilter || tagFilter
                ? "조건에 맞는 디바이스가 없습니다. 위 카드나 필터를 눌러 조건을 바꿔 보세요."
                : "등록된 디바이스가 없습니다. “디바이스 등록”으로 사이니지를 추가해 보세요."}
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        /* 그리드 보기 — 정보는 줄이고 상태(온라인/비정상/오프라인)가 한눈에 보이게 */
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((device) => {
            const st = cretaDeviceStatus(device);
            return (
              <Card
                key={device.id}
                className={cn(
                  "overflow-hidden py-0",
                  GRID_CARD_HOVER,
                  st === "online" && "border-emerald-500/45",
                  st === "error" && "border-red-500/70 ring-1 ring-red-500/35",
                  st === "offline" && "border-zinc-500/45 opacity-80",
                )}
              >
                <Link
                  href={`/devices/${device.id}`}
                  className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-muted/40">
                    <CretaCoverThumb
                      dataUrl={thumbs[`device-${device.id}`]}
                      title={device.source?.title ?? device.name}
                      className="size-full"
                    />
                    {activeAlert &&
                    cretaAlertCoversDevice(activeAlert, device.id) ? (
                      <CretaAlertOverlay alert={activeAlert} compact />
                    ) : null}
                    <span
                      className={cn(
                        "absolute left-2 top-2 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow",
                        st === "online" && "bg-emerald-600/95",
                        st === "error" && "bg-red-600/95",
                        st === "offline" && "bg-zinc-600/95",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full bg-white",
                          st === "error" && "animate-pulse",
                        )}
                        aria-hidden
                      />
                      {st === "online"
                        ? "온라인"
                        : st === "error"
                          ? "비정상"
                          : "오프라인"}
                    </span>
                  </div>
                  <div className="space-y-0.5 px-3 py-2.5">
                    <p className="truncate text-sm font-medium">
                      {device.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {device.location || "위치 미지정"}
                    </p>
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y divide-border px-0">
            {list.map((device) => (
              <div
                key={device.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6",
                  LIST_ROW_INSIDE_CARD_HOVER,
                )}
              >
                {/* 모바일은 basis-full로 본문이 한 줄을 전부 쓰고 버튼은 아랫줄로 내려간다 */}
                <Link
                  href={`/devices/${device.id}`}
                  className="flex min-w-0 grow basis-full items-center gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:basis-0"
                >
                  <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md">
                    <CretaCoverThumb
                      dataUrl={thumbs[`device-${device.id}`]}
                      title={device.source?.title ?? device.name}
                      className="size-full"
                    />
                    {activeAlert &&
                    cretaAlertCoversDevice(activeAlert, device.id) ? (
                      <CretaAlertOverlay alert={activeAlert} compact />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {device.name}
                      </p>
                      <DeviceStatusBadge device={device} />
                      {activeAlert &&
                      cretaAlertCoversDevice(activeAlert, device.id) ? (
                        <Badge className="shrink-0 border-0 bg-red-600 text-[10px] text-white">
                          긴급 알림
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {device.location || "위치 미지정"} · {device.resolution}
                    </p>
                    {device.tags.length > 0 ? (
                      <p className="mt-1 flex flex-wrap items-center gap-1">
                        {device.tags.map((t) => (
                          <Badge
                            key={t}
                            variant="outline"
                            className="px-1.5 text-[10px] text-muted-foreground"
                          >
                            {t}
                          </Badge>
                        ))}
                      </p>
                    ) : null}
                  </div>
                  <div className="hidden min-w-0 flex-1 sm:block">
                    <p className="text-xs text-muted-foreground">재생 중</p>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                      <Badge
                        variant={device.source ? "secondary" : "outline"}
                        className="shrink-0 text-[11px]"
                      >
                        {device.source
                          ? PLAY_SOURCE_LABEL[device.source.kind]
                          : PLAY_SOURCE_LABEL.none}
                      </Badge>
                      <span className="truncate text-sm font-medium">
                        {device.source?.title ?? "—"}
                      </span>
                    </div>
                  </div>
                </Link>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`${device.name} 재생`}
                    onClick={() =>
                      toast.info(
                        `시뮬레이션: "${device.name}" 재생 명령을 보냈습니다.`,
                      )
                    }
                  >
                    <Play className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`${device.name} 새로고침`}
                    onClick={() =>
                      toast.info(
                        `시뮬레이션: "${device.name}" 새로고침 명령을 보냈습니다.`,
                      )
                    }
                  >
                    <RotateCw className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/devices/${device.id}`)}
                  >
                    원격제어
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${device.name} 삭제`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (!user) {
                        toast.error("로그인이 필요합니다.");
                        return;
                      }
                      // 화면은 소유자 컬럼이 없는 전역 자원이라 서버가 관리자만 허용한다.
                      // 프로덕션에서는 서버 액션 오류 상세가 가려지므로 여기서 이유를 알린다.
                      if (!isAdminUser(user)) {
                        toast.error("디바이스 삭제는 관리자만 할 수 있습니다.");
                        return;
                      }
                      setDeleteTarget({ id: device.id, name: device.name });
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 디바이스 등록 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>디바이스 등록</DialogTitle>
            <DialogDescription>
              사이니지 재생 시뮬레이션 대상 디바이스를 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="device-name">이름</Label>
              <Input
                id="device-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 로비 메인 디스플레이"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="device-location">위치(선택)</Label>
              <Input
                id="device-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="예: 본사 1F"
                maxLength={120}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="device-platform">플랫폼</Label>
                <NativeSelect
                  id="device-platform"
                  value={form.platform}
                  onChange={(e) =>
                    setForm({ ...form, platform: e.target.value })
                  }
                >
                  <option value="Windows">Windows</option>
                  <option value="Android">Android</option>
                  <option value="WebOS">WebOS</option>
                  <option value="Tizen">Tizen</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="device-resolution">해상도</Label>
                <NativeSelect
                  id="device-resolution"
                  value={form.resolution}
                  onChange={(e) =>
                    setForm({ ...form, resolution: e.target.value })
                  }
                >
                  <option value="1920×1080">1920×1080</option>
                  <option value="3840×2160">3840×2160</option>
                  <option value="1080×1920">1080×1920</option>
                  <option value="7680×2160">7680×2160</option>
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>방향</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={form.orientation === "가로" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, orientation: "가로" })}
                >
                  가로
                </Button>
                <Button
                  type="button"
                  variant={form.orientation === "세로" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, orientation: "세로" })}
                >
                  세로
                </Button>
              </div>
            </div>
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
              disabled={!form.name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "등록 중…" : "등록"}
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
            <AlertDialogTitle>디바이스 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」을(를) 삭제합니다.
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
