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
import { PLAY_SOURCE_LABEL } from "@/lib/creta-api";
import {
  fetchCretaPlayReport,
  formatPlayDuration,
  type PlayReportRange,
} from "@/lib/creta-reports-api";
import { formatDateMediumShort } from "@/lib/format-date";
import { cretaKeys } from "@/lib/query-keys";

const RANGE_LABEL: Record<PlayReportRange, string> = {
  1: "오늘(24시간)",
  7: "최근 7일",
  30: "최근 30일",
};

function kindLabel(kind: string): string {
  return kind === "book" || kind === "playlist" || kind === "schedule"
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
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-2 font-medium">콘텐츠</th>
                          <th className="px-2 py-2 text-right font-medium">
                            횟수
                          </th>
                          <th className="px-2 py-2 text-right font-medium">
                            재생 시간
                          </th>
                          <th className="py-2 pl-2 text-right font-medium">
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
                                <span className="truncate font-medium">
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
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-2 font-medium">디바이스</th>
                          <th className="px-2 py-2 text-right font-medium">
                            횟수
                          </th>
                          <th className="px-2 py-2 text-right font-medium">
                            재생 시간
                          </th>
                          <th className="py-2 pl-2 text-right font-medium">
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
                              <span className="block truncate font-medium">
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
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-2 font-medium">시작 시각</th>
                        <th className="px-2 py-2 font-medium">디바이스</th>
                        <th className="px-2 py-2 font-medium">콘텐츠</th>
                        <th className="py-2 pl-2 text-right font-medium">
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
                            <span className="block truncate">
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
                              <span className="truncate">{row.title}</span>
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
        </>
      )}
    </div>
  );
}
