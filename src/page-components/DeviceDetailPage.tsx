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
  ScreenShare,
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
import { DeviceRemoteScreenDialog } from "@/components/creta/DeviceRemoteScreenDialog";
import { DeviceResourceGauges } from "@/components/creta/DeviceResourceGauges";
import { DeviceSampleLogCard } from "@/components/creta/DeviceSampleLogCard";
import { DeviceStatusBadge } from "@/components/creta/DeviceStatusBadge";
import { DeviceTagsCard } from "@/components/creta/DeviceTagsCard";
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
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cretaAlertCoversDevice } from "@/lib/creta-alerts-api";
import {
  CRETA_PLAYER_LATEST,
  type CretaDevice,
  type CretaDevicePowerInput,
  deviceSimMeta,
  fetchCretaDevice,
  PLAY_SOURCE_LABEL,
  updateCretaDeviceControls,
  updateCretaDeviceHealth,
  updateCretaDeviceOnline,
  updateCretaDevicePower,
  updateCretaDeviceSource,
  upgradeCretaDevicePlayer,
} from "@/lib/creta-api";
import { formatDateMediumShort } from "@/lib/format-date";
import { goBackOrPush } from "@/lib/navigate-back";
import { cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

/** 재생 소스 탭에서 다루는 타입 */
type AssignableSource = "book" | "playlist" | "schedule" | "ad";

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
  /** 슬라이더 드래그 중 임시값 — null이면 서버 값 표시 */
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [brightnessDraft, setBrightnessDraft] = useState<number | null>(null);
  /** 재부팅 연출(시뮬레이션) — 몇 초간 재생 화면을 부팅 오버레이로 덮는다 */
  const [rebooting, setRebooting] = useState(false);
  /** 스크린샷 다이얼로그 — 현재 소스 커버를 "방금 찍은 화면"으로 보여준다 */
  const [screenshotAt, setScreenshotAt] = useState<Date | null>(null);
  /** 원격 화면(시뮬레이션) — 가상 기기 화면을 원격 프로그램처럼 표시 */
  const [remoteOpen, setRemoteOpen] = useState(false);

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
      type: "none" | "book" | "playlist" | "schedule" | "ad";
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
  /** 볼륨·밝기 저장 — 슬라이더 놓을 때(onValueCommit) 호출 */
  const controlsMutation = useMutation({
    mutationFn: (input: { volume?: number; brightness?: number }) =>
      updateCretaDeviceControls(deviceId, input),
    onSuccess: (res) => {
      applyDevice(res);
      setVolumeDraft(null);
      setBrightnessDraft(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const playerUpgradeMutation = useMutation({
    mutationFn: () => upgradeCretaDevicePlayer(deviceId),
    onSuccess: (res) => {
      applyDevice(res);
      toast.success(
        `플레이어를 Creta Player ${res.playerVersion}(으)로 업데이트했습니다.`,
      );
    },
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
  /** 재부팅 연출 — 4초간 부팅 화면을 보여준 뒤 완료 토스트 */
  const handleReboot = () => {
    if (rebooting) return;
    setRebooting(true);
    toast.info(`시뮬레이션: "${device.name}" 재부팅을 시작했습니다.`);
    window.setTimeout(() => {
      setRebooting(false);
      toast.success(
        `"${device.name}" 재부팅 완료 — 콘텐츠 재생을 다시 시작했습니다.`,
      );
    }, 4000);
  };
  const volumeVal = volumeDraft ?? device.volume;
  const brightnessVal = brightnessDraft ?? device.brightness;
  const playerOutdated = device.playerVersion !== CRETA_PLAYER_LATEST;

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
                disabled={rebooting}
                onClick={handleReboot}
              >
                <Power className="size-4" aria-hidden />
                {rebooting ? "재부팅 중…" : "재시작"}
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
                {rebooting ? (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black text-slate-200">
                    <Spinner className="size-8" />
                    <p className="text-sm font-medium">재부팅 중…</p>
                    <p className="text-xs text-slate-400">
                      Creta Player {device.playerVersion}
                    </p>
                  </div>
                ) : null}
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
                  disabled={rebooting}
                  onClick={handleReboot}
                >
                  <Power className="size-4" aria-hidden />
                  {rebooting ? "재부팅 중…" : "재시작"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setScreenshotAt(new Date())}
                >
                  <Camera className="size-4" aria-hidden />
                  스크린샷
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => setRemoteOpen(true)}
                >
                  <ScreenShare className="size-4" aria-hidden />
                  원격 화면
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-sm text-muted-foreground">
                  볼륨
                </span>
                <Slider
                  value={[volumeVal]}
                  onValueChange={(v) => setVolumeDraft(v[0] ?? 0)}
                  onValueCommit={(v) => {
                    if (!requireLogin()) {
                      setVolumeDraft(null);
                      return;
                    }
                    controlsMutation.mutate({ volume: v[0] ?? 0 });
                  }}
                  max={100}
                  step={1}
                  aria-label="볼륨"
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums">
                  {volumeVal}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-sm text-muted-foreground">
                  밝기
                </span>
                <Slider
                  value={[brightnessVal]}
                  onValueChange={(v) => setBrightnessDraft(v[0] ?? 0)}
                  onValueCommit={(v) => {
                    if (!requireLogin()) {
                      setBrightnessDraft(null);
                      return;
                    }
                    controlsMutation.mutate({ brightness: v[0] ?? 0 });
                  }}
                  max={100}
                  step={1}
                  aria-label="밝기"
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums">
                  {brightnessVal}%
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
                <div className="flex items-center justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
                  <span className="shrink-0 text-muted-foreground">
                    플레이어
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-right font-medium">
                      {meta.player}
                    </span>
                    {playerOutdated ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 shrink-0 px-2 text-[11px]"
                        disabled={playerUpgradeMutation.isPending}
                        onClick={() => {
                          if (!requireLogin()) return;
                          playerUpgradeMutation.mutate();
                        }}
                      >
                        {playerUpgradeMutation.isPending
                          ? "업데이트 중…"
                          : `${CRETA_PLAYER_LATEST} 업데이트`}
                      </Button>
                    ) : (
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        최신
                      </span>
                    )}
                  </span>
                </div>
                <InfoRow label="마지막 동기화" value={meta.lastSync} />
                <InfoRow label="가동 시간" value={meta.uptime} />
              </div>
            </CardContent>
          </Card>

          {/* 서버 태그가 바뀌면 key로 다시 마운트해 편집 상태를 동기화 */}
          <DeviceTagsCard
            key={`${device.id}|${device.tags.join(",")}`}
            device={device}
            requireLogin={requireLogin}
          />

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
                  <TabsTrigger value="ad" className="flex-1">
                    광고
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
                  disabled={sourceMutation.isPending}
                  onClick={() => {
                    if (!requireLogin()) return;
                    // 광고 전용 재생은 참조 선택이 없어 바로 지정
                    if (activeTab === "ad") {
                      sourceMutation.mutate({ type: "ad" });
                      return;
                    }
                    setChangeOpen(true);
                  }}
                >
                  {activeTab === "ad"
                    ? assignedForTab
                      ? "지정됨"
                      : "광고 전용 지정"
                    : "변경"}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {activeTab === "ad"
                  ? "광고 전용 재생 — 광고 메뉴의 활성 캠페인 소재만 100% 루프로 재생합니다(엘리베이터 광고 모니터형)."
                  : "위의 재생 소스 탭으로 타입을 바꾸고, ‘변경’으로 해당 타입의 다른 항목을 선택할 수 있습니다."}
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

      {/* 원격 화면(시뮬레이션) — 가상 PC/모바일 기기 화면 */}
      {remoteOpen ? (
        <DeviceRemoteScreenDialog
          device={device}
          activeAlert={activeAlert ?? null}
          alertCovers={alertCoversThis}
          previewThumb={previewThumb}
          open={remoteOpen}
          onOpenChange={setRemoteOpen}
        />
      ) : null}

      {/* 스크린샷(시뮬레이션) — 현재 소스 커버를 "방금 찍은 화면"으로 표시 */}
      <Dialog
        open={screenshotAt != null}
        onOpenChange={(o) => {
          if (!o) setScreenshotAt(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="size-4 text-muted-foreground" aria-hidden />
              화면 스크린샷
            </DialogTitle>
            <DialogDescription>
              「{device.name}」이 지금 표시 중인 화면입니다(시뮬레이션 캡처).
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-border">
            {!device.online ? (
              <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                오프라인 — 화면을 가져올 수 없습니다
              </span>
            ) : activeAlert && alertCoversThis ? (
              <CretaAlertOverlay alert={activeAlert} />
            ) : device.source ? (
              <>
                {previewThumb ? (
                  <CretaCoverThumb
                    dataUrl={previewThumb}
                    title={device.source.title}
                    className="absolute inset-0 size-full"
                  />
                ) : null}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-3 py-1.5 text-xs text-white">
                  {PLAY_SOURCE_LABEL[device.source.kind]} ·{" "}
                  {device.source.title}
                </span>
              </>
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                지정된 재생 소스 없음
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            캡처 시각:{" "}
            {screenshotAt
              ? formatDateMediumShort(screenshotAt.toISOString())
              : ""}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setScreenshotAt(null)}
            >
              닫기
            </Button>
            <Button
              type="button"
              onClick={() => {
                setScreenshotAt(new Date());
                toast.success("다시 캡처했습니다.");
              }}
            >
              다시 캡처
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 재생 소스 변경 */}
      {changeOpen ? (
        <CretaSourceDialog
          open={changeOpen}
          onOpenChange={setChangeOpen}
          title={`${PLAY_SOURCE_LABEL[activeTab]} 지정`}
          description="선택한 콘텐츠를 이 디바이스에서 재생합니다."
          kinds={[activeTab === "ad" ? "book" : activeTab]}
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
