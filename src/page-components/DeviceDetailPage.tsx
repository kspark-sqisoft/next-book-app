"use client";

// 디바이스 상세: 현재 재생 소스의 커버 미리보기, 재생 소스(북/플레이리스트/스케줄)
// 변경, 온라인 상태 토글이 DB에 반영된다. 원격 제어 버튼은 시뮬레이션(토스트).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  Pause,
  Play,
  Power,
  RotateCw,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CretaAlertBanner,
  CretaAlertOverlay,
  useActiveCretaAlert,
} from "@/components/creta/CretaAlertControls";
import {
  CretaCoverThumb,
  useCretaCoverThumbs,
} from "@/components/creta/CretaCoverThumb";
import { CretaSourceDialog } from "@/components/creta/CretaSourceDialog";
import { DevicePowerScheduleCard } from "@/components/creta/DevicePowerScheduleCard";
import { DeviceResourceGauges } from "@/components/creta/DeviceResourceGauges";
import { DeviceSampleLogCard } from "@/components/creta/DeviceSampleLogCard";
import { DeviceStatusBadge } from "@/components/creta/DeviceStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cretaAlertCoversDevice } from "@/lib/creta-alerts-api";
import {
  type CretaDevice,
  type CretaDevicePowerInput,
  deviceSimMeta,
  fetchCretaDevice,
  PLAY_SOURCE_LABEL,
  updateCretaDeviceHealth,
  updateCretaDeviceOnline,
  updateCretaDevicePower,
  updateCretaDeviceSource,
} from "@/lib/creta-api";
import { goBackOrPush } from "@/lib/navigate-back";
import { cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

/** 재생 소스 탭에서 다루는 타입 */
type AssignableSource = "book" | "playlist" | "schedule";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}

export function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const deviceId = Number(params.id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AssignableSource | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [volume, setVolume] = useState([70]);

  const {
    data: device,
    isLoading,
    isError,
  } = useQuery({
    queryKey: cretaKeys.device(deviceId),
    queryFn: () => fetchCretaDevice(deviceId),
    enabled: Number.isFinite(deviceId) && deviceId > 0,
  });
  /** 활성 긴급 알림 — 이 디바이스가 대상이면 재생 표시를 덮는다 */
  const { data: activeAlert } = useActiveCretaAlert();

  const applyDevice = (res: CretaDevice) => {
    queryClient.setQueryData(cretaKeys.device(deviceId), res);
    void queryClient.invalidateQueries({ queryKey: cretaKeys.devices() });
    void queryClient.invalidateQueries({ queryKey: cretaKeys.schedules() });
  };

  const sourceMutation = useMutation({
    mutationFn: (input: {
      type: "none" | "book" | "playlist" | "schedule";
      refId?: number;
    }) => updateCretaDeviceSource(deviceId, input),
    onSuccess: (res) => {
      applyDevice(res);
      setChangeOpen(false);
      toast.success(
        res.source
          ? `재생 소스를 「${res.source.title}」(으)로 지정했습니다.`
          : "재생 소스를 해제했습니다.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const onlineMutation = useMutation({
    mutationFn: (online: boolean) => updateCretaDeviceOnline(deviceId, online),
    onSuccess: applyDevice,
    onError: (e: Error) => toast.error(e.message),
  });
  const healthMutation = useMutation({
    mutationFn: (health: "ok" | "error") =>
      updateCretaDeviceHealth(deviceId, health),
    onSuccess: applyDevice,
    onError: (e: Error) => toast.error(e.message),
  });
  const powerMutation = useMutation({
    mutationFn: (input: CretaDevicePowerInput) =>
      updateCretaDevicePower(deviceId, input),
    onSuccess: (res) => {
      applyDevice(res);
      toast.success(
        res.powerOnTime || res.powerOffTime
          ? `전원 예약을 저장했습니다 (${res.powerOnTime ?? "—"} 켜짐 · ${res.powerOffTime ?? "—"} 꺼짐).`
          : "전원 예약을 해제했습니다.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 커버 미리보기(현재 소스)
  const thumbEntries = useMemo(
    () =>
      device?.source?.cover
        ? [{ key: `device-detail-${device.id}`, cover: device.source.cover }]
        : [],
    [device],
  );
  const thumbs = useCretaCoverThumbs(thumbEntries);

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

  if (isError || !device) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          디바이스를 찾을 수 없습니다.
        </p>
        <Button asChild variant="outline">
          <Link href="/devices">
            <ArrowLeft className="size-4" aria-hidden />
            디바이스 목록으로
          </Link>
        </Button>
      </div>
    );
  }

  const meta = deviceSimMeta(device);
  const alertCoversThis =
    activeAlert != null && cretaAlertCoversDevice(activeAlert, device.id);
  const activeTab: AssignableSource =
    tab ?? (device.source ? device.source.kind : "book");
  const assignedForTab =
    device.source && device.source.kind === activeTab ? device.source : null;
  const previewThumb = thumbs[`device-detail-${device.id}`];
  const remoteCommand = (label: string) =>
    toast.info(`시뮬레이션: "${device.name}"에 ${label} 명령을 보냈습니다.`);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => goBackOrPush(router, "/devices")}
        className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        디바이스
      </button>

      {activeAlert && alertCoversThis ? (
        <CretaAlertBanner alert={activeAlert} />
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-bold">{device.name}</h1>
              <DeviceStatusBadge device={device} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {device.location || "위치 미지정"} · {device.platform} ·{" "}
              {device.resolution}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              온라인 시뮬레이션
              <Switch
                checked={device.online}
                disabled={onlineMutation.isPending}
                onCheckedChange={(checked) =>
                  requireLogin() && onlineMutation.mutate(checked)
                }
                aria-label="온라인 상태 전환"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              비정상 시뮬레이션
              <Switch
                checked={device.health === "error"}
                disabled={healthMutation.isPending}
                onCheckedChange={(checked) =>
                  requireLogin() &&
                  healthMutation.mutate(checked ? "error" : "ok")
                }
                aria-label="비정상 단말 상태 전환"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => remoteCommand("재생")}>
                <Play className="size-4" aria-hidden />
                재생
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => remoteCommand("새로고침")}
              >
                <RotateCw className="size-4" aria-hidden />
                새로고침
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => remoteCommand("재시작")}
              >
                <Power className="size-4" aria-hidden />
                재시작
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm font-semibold">현재 재생 중</p>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 ring-1 ring-border">
                {activeAlert && alertCoversThis && device.online ? (
                  <CretaAlertOverlay alert={activeAlert} />
                ) : null}
                {device.online && device.source ? (
                  <>
                    {previewThumb ? (
                      <CretaCoverThumb
                        dataUrl={previewThumb}
                        title={device.source.title}
                        className="absolute inset-0 size-full rounded-lg"
                      />
                    ) : null}
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/55 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[11px]"
                        >
                          {PLAY_SOURCE_LABEL[device.source.kind]}
                        </Badge>
                        <span className="truncate text-sm font-semibold text-white">
                          {device.source.title}
                        </span>
                      </span>
                      {device.source.kind === "book" ? (
                        <Link
                          href={`/books/${device.source.id}/preview`}
                          className="shrink-0 text-xs font-medium text-white underline-offset-2 hover:underline"
                        >
                          미리보기 →
                        </Link>
                      ) : null}
                    </span>
                  </>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                    {device.online ? "지정된 재생 소스 없음" : "오프라인"}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <p className="text-sm font-semibold">원격 제어</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remoteCommand("재생")}
                >
                  <Play className="size-4" aria-hidden />
                  재생
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remoteCommand("일시정지")}
                >
                  <Pause className="size-4" aria-hidden />
                  일시정지
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remoteCommand("정지")}
                >
                  <Square className="size-4" aria-hidden />
                  정지
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remoteCommand("새로고침")}
                >
                  <RotateCw className="size-4" aria-hidden />
                  새로고침
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remoteCommand("재시작")}
                >
                  <Power className="size-4" aria-hidden />
                  재시작
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remoteCommand("스크린샷")}
                >
                  <Camera className="size-4" aria-hidden />
                  스크린샷
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-sm text-muted-foreground">
                  볼륨
                </span>
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  aria-label="볼륨"
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums">
                  {volume[0]}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm font-semibold">리소스 사용률</p>
              <DeviceResourceGauges
                cpuPct={meta.cpuPct}
                ramPct={meta.ramPct}
                ssdPct={meta.ssdPct}
                offline={!device.online}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent>
              <p className="text-sm font-semibold">디바이스 정보</p>
              <div className="mt-2">
                <InfoRow label="플랫폼" value={device.platform} />
                <InfoRow label="해상도" value={device.resolution} />
                <InfoRow label="방향" value={device.orientation} />
                <InfoRow
                  label="위치"
                  value={device.location || "위치 미지정"}
                />
                <InfoRow label="IP 주소" value={meta.ip} />
                <InfoRow label="플레이어" value={meta.player} />
                <InfoRow label="마지막 동기화" value={meta.lastSync} />
                <InfoRow label="가동 시간" value={meta.uptime} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm font-semibold">재생 소스</p>
              <Tabs
                value={activeTab}
                onValueChange={(v) => setTab(v as AssignableSource)}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="book" className="flex-1">
                    북
                  </TabsTrigger>
                  <TabsTrigger value="playlist" className="flex-1">
                    플레이리스트
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="flex-1">
                    스케줄
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-sm font-semibold">할당된 콘텐츠</p>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                {assignedForTab ? (
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {PLAY_SOURCE_LABEL[assignedForTab.kind]}
                    </p>
                    <p className="truncate text-sm font-medium text-primary">
                      {assignedForTab.title}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    할당된 {PLAY_SOURCE_LABEL[activeTab]} 없음
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => requireLogin() && setChangeOpen(true)}
                >
                  변경
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                위의 재생 소스 탭으로 타입을 바꾸고, ‘변경’으로 해당 타입의 다른
                항목을 선택할 수 있습니다.
              </p>
            </CardContent>
          </Card>

          {/* 서버 값이 바뀌면 key로 다시 마운트해 입력값을 동기화 */}
          <DevicePowerScheduleCard
            key={`${device.id}|${device.powerOnTime ?? ""}|${device.powerOffTime ?? ""}|${device.powerExcludeDays.join(",")}|${device.powerExcludeDates.join(",")}`}
            powerOnTime={device.powerOnTime}
            powerOffTime={device.powerOffTime}
            powerExcludeDays={device.powerExcludeDays}
            powerExcludeDates={device.powerExcludeDates}
            pending={powerMutation.isPending}
            canEdit={requireLogin}
            onSave={(next) => powerMutation.mutate(next)}
          />
        </div>
      </div>

      <DeviceSampleLogCard device={device} />

      {/* 재생 소스 변경 */}
      {changeOpen ? (
        <CretaSourceDialog
          open={changeOpen}
          onOpenChange={setChangeOpen}
          title={`${PLAY_SOURCE_LABEL[activeTab]} 지정`}
          description="선택한 콘텐츠를 이 디바이스에서 재생합니다."
          kinds={[activeTab]}
          pending={sourceMutation.isPending}
          clearLabel="지정 해제"
          onClear={() => sourceMutation.mutate({ type: "none" })}
          onSubmit={(kind, option) =>
            sourceMutation.mutate({
              type: kind as AssignableSource,
              refId: option.id,
            })
          }
        />
      ) : null}
    </div>
  );
}
