"use client";

// 운영 대시보드: 디바이스 온라인율·문제 단말·지금 재생 중 콘텐츠·오늘 재생 요약을 한 화면에.
// 10초 폴링으로 갱신되고, 긴급 알림이 활성일 땐 상단에 배너가 뜬다.
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  HeartPulse,
  MonitorSmartphone,
  PlaySquare,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  CretaAlertBanner,
  useActiveCretaAlert,
} from "@/components/creta/CretaAlertControls";
import {
  CretaCoverThumb,
  useCretaCoverThumbs,
} from "@/components/creta/CretaCoverThumb";
import { DeviceStatusBadge } from "@/components/creta/DeviceStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BOOK_AUDIT_ACTION_LABEL, fetchRecentBookAudit } from "@/lib/api";
import {
  type CretaDevice,
  cretaDeviceStatus,
  fetchCretaDevices,
  PLAY_SOURCE_LABEL,
} from "@/lib/creta-api";
import {
  type DeviceUptimeRange,
  fetchCretaDeviceUptime,
  fetchCretaPlayReport,
  formatPlayDuration,
} from "@/lib/creta-reports-api";
import { formatDateMediumShort } from "@/lib/format-date";
import { bookKeys, cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

/** 지금 재생 중 콘텐츠 요약 — 같은 소스를 재생 중인 온라인 디바이스 묶음 */
function groupPlaying(devices: CretaDevice[]) {
  const map = new Map<
    string,
    { kind: string; title: string; deviceNames: string[] }
  >();
  for (const d of devices) {
    if (!d.online || !d.source) continue;
    const key = `${d.source.kind}-${d.source.id}`;
    const cur = map.get(key) ?? {
      kind: d.source.kind,
      title: d.source.title,
      deviceNames: [],
    };
    cur.deviceNames.push(d.name);
    map.set(key, cur);
  }
  return [...map.values()].sort(
    (a, b) => b.deviceNames.length - a.deviceNames.length,
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: devices, isLoading } = useQuery({
    queryKey: cretaKeys.devices(),
    queryFn: fetchCretaDevices,
    refetchInterval: 10_000,
  });
  /** 최근 활동(북 감사 로그) — 로그인 시에만 조회 */
  const { data: recentAudit } = useQuery({
    queryKey: [...bookKeys.all, "audit-recent"],
    queryFn: fetchRecentBookAudit,
    enabled: user != null,
    refetchInterval: 30_000,
  });
  const { data: activeAlert } = useActiveCretaAlert();
  const { data: todayReport } = useQuery({
    queryKey: cretaKeys.playReport(1),
    queryFn: () => fetchCretaPlayReport(1),
    refetchInterval: 60_000,
  });
  /** 디바이스 가동률·장애율(기간별) — 시간당 상태 스냅샷 집계 */
  const [uptimeRange, setUptimeRange] = useState<DeviceUptimeRange>(7);
  const { data: uptime } = useQuery({
    queryKey: cretaKeys.deviceUptime(uptimeRange),
    queryFn: () => fetchCretaDeviceUptime(uptimeRange),
    refetchInterval: 60_000,
  });

  const list = useMemo(() => devices ?? [], [devices]);
  /** 가동률 행 앞 썸네일 — 디바이스가 지금 재생 중인 소스의 커버 */
  const thumbEntries = useMemo(
    () =>
      list.map((d) => ({
        key: `device-${d.id}`,
        cover: d.source?.cover ?? null,
      })),
    [list],
  );
  const deviceThumbs = useCretaCoverThumbs(thumbEntries);
  const online = list.filter((d) => cretaDeviceStatus(d) === "online");
  const problems = list.filter((d) => cretaDeviceStatus(d) !== "online");
  const onlinePct =
    list.length > 0 ? Math.round((100 * online.length) / list.length) : 0;
  const playing = useMemo(() => groupPlaying(list), [list]);

  const stats = [
    {
      label: "온라인율",
      value: list.length > 0 ? `${onlinePct}%` : "—",
      sub: `${online.length}/${list.length}대 온라인`,
    },
    {
      label: "문제 디바이스",
      value: `${problems.length}대`,
      sub: "오프라인·비정상",
    },
    {
      label: "오늘 재생 횟수",
      value: todayReport ? todayReport.totalPlays.toLocaleString() : "—",
      sub: "최근 24시간",
    },
    {
      label: "오늘 재생 시간",
      value: todayReport
        ? formatPlayDuration(todayReport.totalDurationSec)
        : "—",
      sub: "최근 24시간",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">운영 대시보드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          디바이스 상태와 재생 현황을 한눈에 봅니다. 10초마다 자동 갱신됩니다.
        </p>
      </div>

      {activeAlert ? <CretaAlertBanner alert={activeAlert} /> : null}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {stat.sub}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 디바이스 가동률·장애율 — 시간당 상태 스냅샷(시뮬레이션)의 기간별 집계 */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <HeartPulse className="size-4 text-emerald-500" aria-hidden />
                  디바이스 가동률·장애율
                  {uptime ? (
                    <span className="font-normal text-muted-foreground">
                      평균 가동률{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {uptime.overallUptimePct}%
                      </span>{" "}
                      · 장애율{" "}
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {uptime.overallErrorPct}%
                      </span>
                    </span>
                  ) : null}
                </p>
                <Tabs
                  value={String(uptimeRange)}
                  onValueChange={(v) =>
                    setUptimeRange(Number(v) as DeviceUptimeRange)
                  }
                >
                  <TabsList className="h-7">
                    <TabsTrigger value="7" className="px-2 text-xs">
                      최근 7일
                    </TabsTrigger>
                    <TabsTrigger value="30" className="px-2 text-xs">
                      최근 30일
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {!uptime ? (
                <div className="flex justify-center py-10">
                  <Spinner className="size-5" />
                </div>
              ) : (
                <>
                  {/* 일자별 스택 막대 — 아래(정상)부터 위(오프라인)로 쌓는다 */}
                  <div className="flex h-28 items-end gap-1">
                    {uptime.byDay.map((d) => {
                      const total = d.online + d.error + d.offline;
                      const p = (n: number) =>
                        total > 0 ? Math.round((100 * n) / total) : 0;
                      const label = d.date.slice(5).replace("-", "/");
                      return (
                        <div
                          key={d.date}
                          className="flex h-full min-w-0 flex-1 flex-col justify-end overflow-hidden rounded-sm bg-muted/30"
                          title={
                            total > 0
                              ? `${label} · 정상 ${p(d.online)}% · 비정상 ${p(d.error)}% · 오프라인 ${p(d.offline)}%`
                              : `${label} · 데이터 없음`
                          }
                        >
                          <div
                            className="w-full bg-zinc-500/60"
                            style={{ height: `${p(d.offline)}%` }}
                          />
                          <div
                            className="w-full bg-red-500/85"
                            style={{ height: `${p(d.error)}%` }}
                          />
                          <div
                            className="w-full bg-emerald-500/80"
                            style={{ height: `${p(d.online)}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
                    <span>
                      {uptime.byDay[0]?.date.slice(5).replace("-", "/")}
                    </span>
                    <span>
                      {uptime.byDay
                        .at(Math.floor(uptime.byDay.length / 2))
                        ?.date.slice(5)
                        .replace("-", "/")}
                    </span>
                    <span>
                      {uptime.byDay.at(-1)?.date.slice(5).replace("-", "/")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-sm bg-emerald-500/80" />
                      정상
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-sm bg-red-500/85" />
                      비정상(장애)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-sm bg-zinc-500/60" />
                      오프라인
                    </span>
                  </div>

                  {/* 디바이스별 가동률 — 문제 많은 단말부터 */}
                  <div className="space-y-1.5 border-t border-border/60 pt-3">
                    {uptime.byDevice.map((d) => (
                      <Link
                        key={d.deviceId}
                        href={`/devices/${d.deviceId}`}
                        className="flex items-center gap-3 rounded-md px-1 py-1 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/40">
                          <CretaCoverThumb
                            dataUrl={deviceThumbs[`device-${d.deviceId}`]}
                            title={
                              /* 커버 없을 때 폴백 — 재생 소스 제목(광고 전용 루프 등) */
                              list.find((x) => x.id === d.deviceId)?.source
                                ?.title ?? d.deviceName
                            }
                            className="absolute inset-0 size-full rounded-md"
                          />
                        </span>
                        <span
                          className="w-36 shrink-0 truncate text-xs font-medium sm:w-48"
                          title={`${d.deviceName} · ${d.location || "위치 미지정"}`}
                        >
                          {d.deviceName}
                        </span>
                        <span className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/40">
                          <span
                            className="h-full bg-emerald-500/80"
                            style={{ width: `${d.uptimePct}%` }}
                          />
                          <span
                            className="h-full bg-red-500/85"
                            style={{ width: `${d.errorPct}%` }}
                          />
                          <span
                            className="h-full bg-zinc-500/60"
                            style={{ width: `${d.offlinePct}%` }}
                          />
                        </span>
                        <span className="w-14 shrink-0 text-right text-xs tabular-nums">
                          {d.uptimePct}%
                        </span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <TriangleAlert
                    className="size-4 text-amber-500"
                    aria-hidden
                  />
                  주의가 필요한 디바이스
                </p>
                {problems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    모든 디바이스가 정상 동작 중입니다. 🎉
                  </p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {problems.map((d) => (
                      <Link
                        key={d.id}
                        href={`/devices/${d.id}`}
                        className="flex items-center justify-between gap-3 py-2 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {d.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {d.location || "위치 미지정"}
                          </p>
                        </div>
                        <DeviceStatusBadge device={d} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <MonitorSmartphone
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  지금 재생 중인 콘텐츠
                </p>
                {playing.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    재생 중인 콘텐츠가 없습니다.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {playing.map((p) => (
                      <div
                        key={`${p.kind}-${p.title}`}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px]"
                          >
                            {p.kind === "book" ||
                            p.kind === "playlist" ||
                            p.kind === "schedule" ||
                            p.kind === "ad"
                              ? PLAY_SOURCE_LABEL[p.kind]
                              : p.kind}
                          </Badge>
                          <span
                            className="truncate text-sm font-medium"
                            title={p.deviceNames.join(", ")}
                          >
                            {p.title}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {p.deviceNames.length}대
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <PlaySquare
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  오늘 많이 재생된 콘텐츠
                </p>
                <Link
                  href="/reports"
                  className="flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  <Activity className="size-3.5" aria-hidden />
                  재생 리포트 전체 보기
                </Link>
              </div>
              {!todayReport || todayReport.byContent.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  오늘 재생 기록이 없습니다.
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {todayReport.byContent.slice(0, 5).map((row) => (
                    <div
                      key={`${row.kind}-${row.contentId}-${row.title}`}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[10px]"
                        >
                          {row.kind === "book" ||
                          row.kind === "playlist" ||
                          row.kind === "schedule" ||
                          row.kind === "ad"
                            ? PLAY_SOURCE_LABEL[row.kind]
                            : row.kind}
                        </Badge>
                        <span className="truncate text-sm font-medium">
                          {row.title}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {row.plays.toLocaleString()}회 ·{" "}
                        {formatPlayDuration(row.durationSec)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {user != null ? (
            <Card>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Activity
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  최근 활동
                  <span className="font-normal text-muted-foreground">
                    (북 변경 이력)
                  </span>
                </p>
                {(recentAudit?.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    아직 기록된 활동이 없습니다.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {recentAudit!.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-start gap-2 py-2 text-sm"
                      >
                        <Badge
                          variant="secondary"
                          className="mt-0.5 shrink-0 text-[10px]"
                        >
                          {BOOK_AUDIT_ACTION_LABEL[row.action]}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="break-words">
                            <span className="font-medium">
                              「{row.bookTitle}」
                            </span>{" "}
                            {row.detail}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {row.actorName} ·{" "}
                            {formatDateMediumShort(row.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
