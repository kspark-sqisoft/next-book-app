"use client";

// 재생 리포트(Proof-of-Play): 어떤 콘텐츠가 언제·어느 디바이스에서 몇 번 재생됐는지.
// 실제 플레이어가 없어 "온라인 + 소스 지정" 구간을 시뮬레이션으로 적재한 로그를 집계한다.
import { useQuery } from "@tanstack/react-query";
import { ChartColumn, MonitorSmartphone, PlaySquare } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchCretaAdCampaignReport,
  fetchCretaAdCampaigns,
  fetchCretaAdDeviceReport,
  fetchCretaAdHourlyReport,
  fetchCretaAdSlotReport,
} from "@/lib/creta-ads-api";
import { PLAY_SOURCE_LABEL } from "@/lib/creta-api";
import {
  fetchCretaPlayReport,
  formatPlayDuration,
  type PlayReportRange,
} from "@/lib/creta-reports-api";
import { formatDateMediumShort } from "@/lib/format-date";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const RANGE_LABEL: Record<PlayReportRange, string> = {
  1: "오늘(24시간)",
  7: "최근 7일",
  30: "최근 30일",
};

function kindLabel(kind: string): string {
  return kind === "book" ||
    kind === "playlist" ||
    kind === "schedule" ||
    kind === "ad"
    ? PLAY_SOURCE_LABEL[kind]
    : kind;
}

export function PlayReportPage() {
  const [range, setRange] = useState<PlayReportRange>(7);
  const { data: report, isLoading } = useQuery({
    queryKey: cretaKeys.playReport(range),
    queryFn: () => fetchCretaPlayReport(range),
    // 온라인 디바이스의 재생이 계속 쌓이므로 주기적으로 갱신
    refetchInterval: 30_000,
  });

  /* 광고 리포트(2단계) — 캠페인별 노출·정산, 시간대 분포, 구좌별 집계 */
  const { data: adCampaignRows } = useQuery({
    queryKey: cretaKeys.adReport(range),
    queryFn: () => fetchCretaAdCampaignReport(range),
    refetchInterval: 60_000,
  });
  const { data: adCampaigns } = useQuery({
    queryKey: cretaKeys.adCampaigns(),
    queryFn: fetchCretaAdCampaigns,
    staleTime: 60_000,
  });
  const { data: adHourly } = useQuery({
    queryKey: cretaKeys.adHourly(range),
    queryFn: () => fetchCretaAdHourlyReport(range),
    refetchInterval: 60_000,
  });
  const { data: adSlots } = useQuery({
    queryKey: cretaKeys.adSlots(range),
    queryFn: () => fetchCretaAdSlotReport(range),
    refetchInterval: 60_000,
  });
  const { data: adDevices } = useQuery({
    queryKey: cretaKeys.adDevices(range),
    queryFn: () => fetchCretaAdDeviceReport(range),
    refetchInterval: 60_000,
  });
  const cpmByCampaign = new Map((adCampaigns ?? []).map((c) => [c.id, c.cpm]));
  const maxHourPlays = Math.max(1, ...(adHourly ?? []).map((h) => h.plays));

  const stats = report
    ? [
        { label: "총 재생 횟수", value: report.totalPlays.toLocaleString() },
        {
          label: "총 재생 시간",
          value: formatPlayDuration(report.totalDurationSec),
        },
        { label: "재생 디바이스", value: `${report.deviceCount}대` },
        { label: "재생 콘텐츠", value: `${report.contentCount}개` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">재생 리포트</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Proof-of-Play — 어떤 콘텐츠가 언제, 어느 디바이스에서 몇 번
            재생됐는지 확인합니다. (플레이어 시뮬레이션 기준)
          </p>
        </div>
        <Tabs
          value={String(range)}
          onValueChange={(v) => setRange(Number(v) as PlayReportRange)}
        >
          <TabsList>
            {([1, 7, 30] as const).map((r) => (
              <TabsTrigger key={r} value={String(r)}>
                {RANGE_LABEL[r]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading || !report ? (
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
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <PlaySquare
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  콘텐츠별 재생
                </p>
                {report.byContent.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    기간 내 재생 기록이 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    {/* 콘텐츠 이름이 핵심 정보 — 고정 레이아웃으로 이름 열을 최대한 넓힌다 */}
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="w-[46%] py-2 pr-2 font-medium">
                            콘텐츠
                          </th>
                          <th className="w-[14%] px-2 py-2 text-right font-medium">
                            횟수
                          </th>
                          <th className="w-[18%] px-2 py-2 text-right font-medium">
                            재생 시간
                          </th>
                          <th className="w-[22%] py-2 pl-2 text-right font-medium">
                            마지막 재생
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byContent.map((row) => (
                          <tr
                            key={`${row.kind}-${row.contentId}-${row.title}`}
                            className="border-b border-border/60 last:border-b-0"
                          >
                            <td className="max-w-0 py-2 pr-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <Badge
                                  variant="secondary"
                                  className="shrink-0 text-[10px]"
                                >
                                  {kindLabel(row.kind)}
                                </Badge>
                                <span
                                  className="truncate font-medium"
                                  title={row.title}
                                >
                                  {row.title}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {row.plays.toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {formatPlayDuration(row.durationSec)}
                            </td>
                            <td className="whitespace-nowrap py-2 pl-2 text-right text-xs text-muted-foreground">
                              {formatDateMediumShort(row.lastPlayedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                  디바이스별 재생
                </p>
                {report.byDevice.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    기간 내 재생 기록이 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    {/* 디바이스명도 잘리지 않게 고정 레이아웃으로 이름 열 확보 */}
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="w-[46%] py-2 pr-2 font-medium">
                            디바이스
                          </th>
                          <th className="w-[14%] px-2 py-2 text-right font-medium">
                            횟수
                          </th>
                          <th className="w-[18%] px-2 py-2 text-right font-medium">
                            재생 시간
                          </th>
                          <th className="w-[22%] py-2 pl-2 text-right font-medium">
                            마지막 재생
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byDevice.map((row) => (
                          <tr
                            key={row.deviceId}
                            className="border-b border-border/60 last:border-b-0"
                          >
                            <td className="max-w-0 py-2 pr-2">
                              <span
                                className="block truncate font-medium"
                                title={row.deviceName}
                              >
                                {row.deviceName}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {row.plays.toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {formatPlayDuration(row.durationSec)}
                            </td>
                            <td className="whitespace-nowrap py-2 pl-2 text-right text-xs text-muted-foreground">
                              {formatDateMediumShort(row.lastPlayedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <ChartColumn
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                최근 재생 로그
                <span className="font-normal text-muted-foreground">
                  (최신 50건)
                </span>
              </p>
              {report.recent.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  기간 내 재생 기록이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  {/* 콘텐츠 열을 가장 넓게 — 고정 레이아웃 */}
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="w-[18%] py-2 pr-2 font-medium">
                          시작 시각
                        </th>
                        <th className="w-[26%] px-2 py-2 font-medium">
                          디바이스
                        </th>
                        <th className="w-[42%] px-2 py-2 font-medium">
                          콘텐츠
                        </th>
                        <th className="w-[14%] py-2 pl-2 text-right font-medium">
                          재생 길이
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.recent.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-border/60 last:border-b-0"
                        >
                          <td className="whitespace-nowrap py-2 pr-2 text-xs text-muted-foreground">
                            {formatDateMediumShort(row.startedAt)}
                          </td>
                          <td className="max-w-0 px-2 py-2">
                            <span
                              className="block truncate"
                              title={row.deviceName}
                            >
                              {row.deviceName}
                            </span>
                          </td>
                          <td className="max-w-0 px-2 py-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Badge
                                variant="secondary"
                                className="shrink-0 text-[10px]"
                              >
                                {kindLabel(row.kind)}
                              </Badge>
                              <span className="truncate" title={row.title}>
                                {row.title}
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">
                            {formatPlayDuration(row.durationSec)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 광고 리포트(Proof-of-Play) — 캠페인·시간대·구좌 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-3">
                <p className="text-sm font-semibold">
                  광고 — 캠페인별 노출·정산
                </p>
                {(adCampaignRows ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    기간 내 광고 노출이 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    {/* 캠페인명이 핵심 — 고정 레이아웃으로 이름 열 확보 */}
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="w-[44%] py-2 pr-2 font-medium">
                            캠페인
                          </th>
                          <th className="w-[14%] px-2 py-2 text-right font-medium">
                            노출수
                          </th>
                          <th className="w-[20%] px-2 py-2 text-right font-medium">
                            노출 시간
                          </th>
                          <th className="w-[22%] py-2 pl-2 text-right font-medium">
                            정산 예상액
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(adCampaignRows ?? []).map((row) => {
                          const cpm = cpmByCampaign.get(row.campaignId) ?? 0;
                          return (
                            <tr
                              key={row.campaignId}
                              className="border-b border-border/60 last:border-b-0"
                            >
                              <td className="max-w-0 py-2 pr-2">
                                <span
                                  className="block truncate"
                                  title={row.campaignName}
                                >
                                  {row.campaignName}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                                {row.plays.toLocaleString()}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                                {formatPlayDuration(row.totalSec)}
                              </td>
                              <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">
                                {Math.round(
                                  (row.plays / 1000) * cpm,
                                ).toLocaleString()}
                                원
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3">
                <p className="text-sm font-semibold">광고 — 시간대별 노출</p>
                {(adHourly ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    기간 내 광고 노출이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {(adHourly ?? []).map((h) => (
                      <div
                        key={h.hour}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-10 shrink-0 tabular-nums text-muted-foreground">
                          {String(h.hour).padStart(2, "0")}시
                        </span>
                        <div className="h-3 min-w-0 flex-1 overflow-hidden rounded bg-muted/40">
                          <div
                            className="h-full rounded bg-amber-500/80"
                            style={{
                              width: `${Math.max(2, (100 * h.plays) / maxHourPlays)}%`,
                            }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right tabular-nums">
                          {h.plays.toLocaleString()}
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
              <p className="text-sm font-semibold">광고 — 화면별 노출</p>
              {(adDevices ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  기간 내 광고 노출이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-2 font-medium">화면</th>
                        <th className="px-2 py-2 text-right font-medium">
                          노출수
                        </th>
                        <th className="py-2 pl-2 text-right font-medium">
                          노출 시간
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(adDevices ?? []).map((row) => (
                        <tr
                          key={row.deviceId ?? "none"}
                          className="border-b border-border/60 last:border-b-0"
                        >
                          <td className="max-w-0 py-2 pr-2">
                            <span
                              className={cn(
                                "block truncate",
                                row.deviceId == null &&
                                  "italic text-muted-foreground",
                              )}
                              title={row.deviceName}
                            >
                              {row.deviceName}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                            {row.plays.toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums text-muted-foreground">
                            {formatPlayDuration(row.seconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm font-semibold">광고 — 구좌별 노출</p>
              {(adSlots ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  기간 내 광고 노출이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  {/* 구좌 식별자가 길어질 수 있어 이름 열을 넓게 확보 */}
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="w-[42%] py-2 pr-2 font-medium">구좌</th>
                        <th className="w-[18%] px-2 py-2 font-medium">
                          위치(북)
                        </th>
                        <th className="w-[16%] px-2 py-2 text-right font-medium">
                          노출수
                        </th>
                        <th className="w-[24%] py-2 pl-2 text-right font-medium">
                          마지막 노출
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(adSlots ?? []).map((row) => (
                        <tr
                          key={`${row.slotElementId}-${row.bookId ?? 0}`}
                          className="border-b border-border/60 last:border-b-0"
                        >
                          <td className="max-w-0 py-2 pr-2">
                            <span
                              className="block truncate font-mono text-xs"
                              title={
                                row.slotElementId === "loop"
                                  ? "루프 삽입(전체 화면)"
                                  : row.slotElementId
                              }
                            >
                              {row.slotElementId === "loop"
                                ? "루프 삽입(전체 화면)"
                                : row.slotElementId}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">
                            {row.bookId != null ? `북 #${row.bookId}` : "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                            {row.plays.toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap py-2 pl-2 text-right text-xs tabular-nums text-muted-foreground">
                            {row.lastPlayedAt
                              ? formatDateMediumShort(row.lastPlayedAt)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
