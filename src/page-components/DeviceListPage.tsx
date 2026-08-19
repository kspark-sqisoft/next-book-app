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
  CretaCoverThumb,
  useCretaCoverThumbs,
} from "@/components/creta/CretaCoverThumb";
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
import {
  createCretaDevice,
  type CretaDevice,
  deleteCretaDevice,
  fetchCretaDevices,
  PLAY_SOURCE_LABEL,
} from "@/lib/creta-api";
import { cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

function OnlineBadge({ online }: { online: boolean }) {
  return online ? (
    <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      온라인
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <span
        className="size-1.5 rounded-full bg-muted-foreground/50"
        aria-hidden
      />
      오프라인
    </Badge>
  );
}

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

  const list: CretaDevice[] = useMemo(() => devices ?? [], [devices]);
  const onlineCount = list.filter((d) => d.online).length;
  const stats = [
    { label: "전체 디바이스", value: list.length, dot: false },
    { label: "온라인", value: onlineCount, dot: true },
    { label: "오프라인", value: list.length - onlineCount, dot: false },
    { label: "HostSync 그룹", value: 1, dot: false },
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
        <h1 className="font-heading text-2xl font-bold">디바이스</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          사이니지 원격 재생 및 상태 관리
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="py-4">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                {stat.value}
                {stat.dot ? (
                  <span
                    className="size-2 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                ) : null}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          디바이스 목록
        </p>
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

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            등록된 디바이스가 없습니다. “디바이스 등록”으로 사이니지를 추가해
            보세요.
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y divide-border px-0">
            {list.map((device) => (
              <div
                key={device.id}
                className="flex flex-wrap items-center gap-4 px-4 py-3 sm:px-6"
              >
                <Link
                  href={`/devices/${device.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CretaCoverThumb
                    dataUrl={thumbs[`device-${device.id}`]}
                    title={device.source?.title ?? device.name}
                    className="h-12 w-20"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {device.name}
                      </p>
                      <OnlineBadge online={device.online} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {device.location || "위치 미지정"} · {device.resolution}
                    </p>
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
                <div className="flex shrink-0 items-center gap-1.5">
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
