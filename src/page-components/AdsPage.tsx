"use client";

// 광고 관리(1단계) — 광고주 → 캠페인(기간·상태·가중치·CPM) → 소재(이미지/영상) + 기본 노출 리포트.
// 구좌(광고 위젯)는 북 편집기에서 배치하고, 여기의 활성 캠페인 소재가 그 구좌에서 순환 재생된다.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  Building2,
  Film,
  Image as ImageIcon,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  addCretaAdCreative,
  createCretaAdCampaign,
  createCretaAdvertiser,
  CRETA_AD_DAY_TARGET_LABEL,
  CRETA_AD_PHASE_LABEL,
  type CretaAdCampaign,
  deleteCretaAdCampaign,
  deleteCretaAdCreative,
  deleteCretaAdvertiser,
  fetchCretaAdCampaignReport,
  fetchCretaAdCampaigns,
  fetchCretaAdSetting,
  fetchCretaAdvertisers,
  updateCretaAdCampaign,
  updateCretaAdSetting,
} from "@/lib/creta-ads-api";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

function todayStr(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function AdsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const advertisersQuery = useQuery({
    queryKey: cretaKeys.adAdvertisers(),
    queryFn: fetchCretaAdvertisers,
  });
  const campaignsQuery = useQuery({
    queryKey: cretaKeys.adCampaigns(),
    queryFn: fetchCretaAdCampaigns,
  });
  const reportQuery = useQuery({
    queryKey: cretaKeys.adReport(30),
    queryFn: () => fetchCretaAdCampaignReport(30),
  });
  const settingQuery = useQuery({
    queryKey: cretaKeys.adSetting(),
    queryFn: fetchCretaAdSetting,
  });
  /** 설정 폼 초안 — 서버 값으로 초기화, 저장 시 반영 */
  const [settingDraft, setSettingDraft] = useState<{
    loopEveryN: string;
    spotSec: string;
    houseName: string;
    houseKind: "image" | "video";
    houseSrc: string;
  } | null>(null);
  const settingForm = settingDraft ?? {
    loopEveryN: String(settingQuery.data?.loopEveryN ?? 0),
    spotSec: String(settingQuery.data?.spotSec ?? 15),
    houseName: settingQuery.data?.houseName ?? "",
    houseKind: settingQuery.data?.houseKind ?? "image",
    houseSrc: settingQuery.data?.houseSrc ?? "",
  };
  const settingSave = useMutation({
    mutationFn: () =>
      updateCretaAdSetting({
        loopEveryN: Number(settingForm.loopEveryN),
        spotSec: Number(settingForm.spotSec),
        houseName: settingForm.houseName,
        houseKind: settingForm.houseKind,
        houseSrc: settingForm.houseSrc,
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(cretaKeys.adSetting(), res);
      setSettingDraft(null);
      toast.success("광고 설정을 저장했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: cretaKeys.adAdvertisers() });
    void queryClient.invalidateQueries({ queryKey: cretaKeys.adCampaigns() });
    void queryClient.invalidateQueries({
      queryKey: cretaKeys.adActiveCreatives(),
    });
  };

  const requireLogin = (): boolean => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return false;
    }
    return true;
  };

  // ── 광고주 등록 ──
  const [advOpen, setAdvOpen] = useState(false);
  const [advForm, setAdvForm] = useState({ name: "", contact: "" });
  const advCreate = useMutation({
    mutationFn: () => createCretaAdvertiser(advForm),
    onSuccess: () => {
      invalidate();
      setAdvOpen(false);
      setAdvForm({ name: "", contact: "" });
      toast.success("광고주를 등록했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── 캠페인 만들기 ──
  const [campOpen, setCampOpen] = useState(false);
  const [campForm, setCampForm] = useState({
    advertiserId: "",
    name: "",
    startDate: todayStr(),
    endDate: todayStr(28),
    weight: "1",
    cpm: "5000",
    dayTarget: "all" as "all" | "weekday" | "weekend",
    startTime: "",
    endTime: "",
  });
  const campCreate = useMutation({
    mutationFn: () =>
      createCretaAdCampaign({
        advertiserId: Number(campForm.advertiserId),
        name: campForm.name,
        startDate: campForm.startDate,
        endDate: campForm.endDate,
        weight: Number(campForm.weight),
        cpm: Number(campForm.cpm) || 0,
        dayTarget: campForm.dayTarget,
        // "HH:MM" → 분. 둘 다 입력했을 때만 시간대 타기팅
        startMin:
          campForm.startTime && campForm.endTime
            ? Number(campForm.startTime.slice(0, 2)) * 60 +
              Number(campForm.startTime.slice(3, 5))
            : null,
        endMin:
          campForm.startTime && campForm.endTime
            ? Number(campForm.endTime.slice(0, 2)) * 60 +
              Number(campForm.endTime.slice(3, 5))
            : null,
      }),
    onSuccess: () => {
      invalidate();
      setCampOpen(false);
      setCampForm((f) => ({ ...f, name: "" }));
      toast.success("캠페인을 만들었습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── 소재 추가 ──
  const [creativeFor, setCreativeFor] = useState<CretaAdCampaign | null>(null);
  const [creativeForm, setCreativeForm] = useState({
    name: "",
    kind: "image" as "image" | "video",
    src: "",
  });
  const creativeAdd = useMutation({
    mutationFn: () => {
      if (!creativeFor) throw new Error("캠페인이 선택되지 않았습니다.");
      return addCretaAdCreative({
        campaignId: creativeFor.id,
        ...creativeForm,
      });
    },
    onSuccess: () => {
      invalidate();
      setCreativeFor(null);
      setCreativeForm({ name: "", kind: "image", src: "" });
      toast.success("소재를 등록했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusToggle = useMutation({
    mutationFn: (c: CretaAdCampaign) =>
      updateCretaAdCampaign(c.id, {
        status: c.status === "live" ? "paused" : "live",
      }),
    onSuccess: (_r, c) => {
      invalidate();
      toast.success(
        c.status === "live"
          ? "캠페인을 일시중지했습니다."
          : "캠페인을 다시 라이브로 전환했습니다.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campDelete = useMutation({
    mutationFn: (id: number) => deleteCretaAdCampaign(id),
    onSuccess: () => {
      invalidate();
      setCampDeleteTarget(null);
      toast.success("캠페인을 삭제했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [campDeleteTarget, setCampDeleteTarget] =
    useState<CretaAdCampaign | null>(null);

  const advDelete = useMutation({
    mutationFn: (id: number) => deleteCretaAdvertiser(id),
    onSuccess: () => {
      invalidate();
      setAdvDeleteTarget(null);
      toast.success("광고주를 삭제했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [advDeleteTarget, setAdvDeleteTarget] = useState<{
    id: number;
    name: string;
    campaignCount: number;
  } | null>(null);

  const creativeDelete = useMutation({
    mutationFn: (id: number) => deleteCretaAdCreative(id),
    onSuccess: () => {
      invalidate();
      toast.success("소재를 삭제했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [creativeDeleteId, setCreativeDeleteId] = useState<number | null>(null);

  const advertisers = advertisersQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];
  const report = reportQuery.data ?? [];
  const playsByCampaign = useMemo(
    () => new Map(report.map((r) => [r.campaignId, r])),
    [report],
  );
  const liveCount = campaigns.filter(
    (c) => c.status === "live" && c.inFlight,
  ).length;
  const totalPlays = report.reduce((a, r) => a + r.plays, 0);
  const totalBilling = report.reduce((a, r) => {
    const cpm = campaigns.find((c) => c.id === r.campaignId)?.cpm ?? 0;
    return a + Math.round((r.plays / 1000) * cpm);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">광고</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            광고주·캠페인·소재를 관리합니다. 활성 캠페인의 소재는 북에 배치한
            광고 위젯(구좌)에서 순환 재생됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => requireLogin() && setAdvOpen(true)}
          >
            <Building2 className="size-4" aria-hidden />
            광고주 등록
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!requireLogin()) return;
              if (advertisers.length === 0) {
                toast.error("먼저 광고주를 등록하세요.");
                return;
              }
              setCampForm((f) => ({
                ...f,
                advertiserId: String(advertisers[0].id),
              }));
              setCampOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            캠페인 만들기
          </Button>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "광고주", value: advertisers.length },
          { label: "활성 캠페인", value: liveCount },
          { label: "노출수(30일)", value: totalPlays },
          {
            label: "정산 예상액(30일)",
            value: `${totalBilling.toLocaleString()}원`,
          },
        ].map((s) => (
          <Card key={s.label} className="py-4">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 루프 삽입·하우스 광고 설정 */}
      <Card className="py-4">
        <CardContent className="space-y-3 px-4">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-semibold">
              루프 삽입 · 하우스 광고 설정
            </p>
            <Button
              type="button"
              size="sm"
              disabled={settingSave.isPending || settingDraft == null}
              onClick={() => requireLogin() && settingSave.mutate()}
            >
              {settingSave.isPending ? "저장 중…" : "설정 저장"}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-loop">전체 화면 루프 삽입</Label>
              <NativeSelect
                id="set-loop"
                value={settingForm.loopEveryN}
                onChange={(e) =>
                  setSettingDraft({
                    ...settingForm,
                    loopEveryN: e.target.value,
                  })
                }
              >
                <option value="0">끔</option>
                {[2, 3, 5, 10].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}페이지마다 1스팟
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-spot">스팟 길이</Label>
              <NativeSelect
                id="set-spot"
                value={settingForm.spotSec}
                onChange={(e) =>
                  setSettingDraft({ ...settingForm, spotSec: e.target.value })
                }
              >
                {[5, 10, 15, 20, 30].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}초
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-house-name">하우스 광고 이름</Label>
              <Input
                id="set-house-name"
                value={settingForm.houseName}
                maxLength={120}
                placeholder="예: 크레타 자체 홍보"
                onChange={(e) =>
                  setSettingDraft({
                    ...settingForm,
                    houseName: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-house-kind">하우스 소재 종류</Label>
              <NativeSelect
                id="set-house-kind"
                value={settingForm.houseKind}
                onChange={(e) =>
                  setSettingDraft({
                    ...settingForm,
                    houseKind: e.target.value === "video" ? "video" : "image",
                  })
                }
              >
                <option value="image">이미지</option>
                <option value="video">영상</option>
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-house-src">
              하우스 소재 URL(비우면 기본 카드)
            </Label>
            <Input
              id="set-house-src"
              className="font-mono text-xs"
              value={settingForm.houseSrc}
              placeholder="/uploads/… 또는 https://…"
              onChange={(e) =>
                setSettingDraft({ ...settingForm, houseSrc: e.target.value })
              }
            />
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            루프 삽입: 프레젠테이션이 N페이지 자동 진행할 때마다 전체 화면 광고
            1스팟을 끼워 넣습니다. 하우스 광고: 팔리지 않은 구좌(활성 소재
            없음)를 채우는 자체 소재입니다.
          </p>
        </CardContent>
      </Card>

      {/* 광고주 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">광고주</p>
        {advertisersQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-5" />
          </div>
        ) : advertisers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              등록된 광고주가 없습니다. “광고주 등록”으로 시작해 보세요.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {advertisers.map((a) => (
              <Card key={a.id} className="py-3">
                <CardContent className="flex items-center gap-3 px-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Building2 className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.contact || "담당자 미지정"} · 캠페인 {a.campaignCount}
                      개
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${a.name} 삭제`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      requireLogin() &&
                      setAdvDeleteTarget({
                        id: a.id,
                        name: a.name,
                        campaignCount: a.campaignCount,
                      })
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 캠페인 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">캠페인</p>
        {campaignsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-5" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              캠페인이 없습니다. 광고주를 등록한 뒤 “캠페인 만들기”로 기간과
              소재를 편성해 보세요.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const rep = playsByCampaign.get(c.id);
              const active = c.status === "live" && c.inFlight;
              return (
                <Card key={c.id} className="py-4">
                  <CardContent className="space-y-3 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgeDollarSign
                        className={cn(
                          "size-5 shrink-0",
                          active ? "text-amber-500" : "text-muted-foreground",
                        )}
                        aria-hidden
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {c.name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {c.advertiserName}
                        </span>
                      </p>
                      <Badge
                        className={cn(
                          "shrink-0 border-0 text-[11px]",
                          active
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
                        )}
                      >
                        {CRETA_AD_PHASE_LABEL[c.phase]}
                      </Badge>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {c.startDate} ~ {c.endDate} ·{" "}
                        {CRETA_AD_DAY_TARGET_LABEL[c.dayTarget]}
                        {c.startMin != null && c.endMin != null
                          ? ` ${String(Math.floor(c.startMin / 60)).padStart(2, "0")}:${String(c.startMin % 60).padStart(2, "0")}~${String(Math.floor(c.endMin / 60)).padStart(2, "0")}:${String(c.endMin % 60).padStart(2, "0")}`
                          : ""}{" "}
                        · 가중치 {c.weight} · CPM {c.cpm.toLocaleString()}원
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={
                          c.status === "live" ? "일시중지" : "라이브 전환"
                        }
                        title={c.status === "live" ? "일시중지" : "라이브 전환"}
                        disabled={statusToggle.isPending}
                        onClick={() => requireLogin() && statusToggle.mutate(c)}
                      >
                        {c.status === "live" ? (
                          <Pause className="size-3.5" aria-hidden />
                        ) : (
                          <Play className="size-3.5" aria-hidden />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${c.name} 삭제`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => requireLogin() && setCampDeleteTarget(c)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>

                    {/* 소재 */}
                    <div className="flex flex-wrap items-center gap-2">
                      {c.creatives.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          소재가 없습니다 — 소재를 추가해야 구좌에 노출됩니다.
                        </p>
                      ) : (
                        c.creatives.map((cr) => (
                          <Popover
                            key={cr.id}
                            open={creativeDeleteId === cr.id}
                            onOpenChange={(open) =>
                              setCreativeDeleteId(open ? cr.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs transition-colors hover:border-destructive/50"
                                title="누르면 삭제 확인"
                              >
                                {cr.kind === "image" ? (
                                  <ImageIcon
                                    className="size-3.5 text-muted-foreground"
                                    aria-hidden
                                  />
                                ) : (
                                  <Film
                                    className="size-3.5 text-muted-foreground"
                                    aria-hidden
                                  />
                                )}
                                <span className="max-w-40 truncate">
                                  {cr.name}
                                </span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="bottom"
                              align="start"
                              sideOffset={6}
                              className="w-56 gap-1.5 p-3"
                            >
                              <p className="text-sm font-semibold">
                                소재를 삭제할까요?
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {cr.name}
                              </p>
                              <div className="mt-1 flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => setCreativeDeleteId(null)}
                                >
                                  취소
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 bg-destructive px-2.5 text-xs text-white hover:bg-destructive/90"
                                  onClick={() => {
                                    if (!requireLogin()) return;
                                    creativeDelete.mutate(cr.id);
                                    setCreativeDeleteId(null);
                                  }}
                                >
                                  삭제
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ))
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          if (!requireLogin()) return;
                          setCreativeForm({
                            name: "",
                            kind: "image",
                            src: "",
                          });
                          setCreativeFor(c);
                        }}
                      >
                        <Plus className="size-3.5" aria-hidden />
                        소재 추가
                      </Button>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        노출 {rep?.plays ?? 0}회(30일)
                        {c.cpm > 0
                          ? ` · 정산 ${Math.round(((rep?.plays ?? 0) / 1000) * c.cpm).toLocaleString()}원`
                          : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 광고주 등록 */}
      <Dialog open={advOpen} onOpenChange={setAdvOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>광고주 등록</DialogTitle>
            <DialogDescription>
              캠페인·정산의 주체가 되는 광고주를 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adv-name">이름</Label>
              <Input
                id="adv-name"
                value={advForm.name}
                maxLength={120}
                placeholder="예: 한빛 커피"
                onChange={(e) =>
                  setAdvForm({ ...advForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-contact">담당자·연락처(선택)</Label>
              <Input
                id="adv-contact"
                value={advForm.contact}
                maxLength={200}
                placeholder="예: 김담당 010-0000-0000"
                onChange={(e) =>
                  setAdvForm({ ...advForm, contact: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdvOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={!advForm.name.trim() || advCreate.isPending}
              onClick={() => advCreate.mutate()}
            >
              {advCreate.isPending ? "등록 중…" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 캠페인 만들기 */}
      <Dialog open={campOpen} onOpenChange={setCampOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>캠페인 만들기</DialogTitle>
            <DialogDescription>
              기간(flight) 안에서 라이브 상태일 때 구좌 로테이션에 들어갑니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="camp-adv">광고주</Label>
              <NativeSelect
                id="camp-adv"
                value={campForm.advertiserId}
                onChange={(e) =>
                  setCampForm({ ...campForm, advertiserId: e.target.value })
                }
              >
                {advertisers.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-name">캠페인 이름</Label>
              <Input
                id="camp-name"
                value={campForm.name}
                maxLength={120}
                placeholder="예: 가을 신메뉴 런칭"
                onChange={(e) =>
                  setCampForm({ ...campForm, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="camp-start">시작일</Label>
                <Input
                  id="camp-start"
                  type="date"
                  value={campForm.startDate}
                  onChange={(e) =>
                    setCampForm({ ...campForm, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-end">종료일</Label>
                <Input
                  id="camp-end"
                  type="date"
                  value={campForm.endDate}
                  onChange={(e) =>
                    setCampForm({ ...campForm, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="camp-weight">가중치(노출 비중)</Label>
                <NativeSelect
                  id="camp-weight"
                  value={campForm.weight}
                  onChange={(e) =>
                    setCampForm({ ...campForm, weight: e.target.value })
                  }
                >
                  {[1, 2, 3, 5, 10].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-cpm">CPM 단가(원)</Label>
                <Input
                  id="camp-cpm"
                  type="number"
                  min={0}
                  value={campForm.cpm}
                  onChange={(e) =>
                    setCampForm({ ...campForm, cpm: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="camp-day">요일 타기팅</Label>
                <NativeSelect
                  id="camp-day"
                  value={campForm.dayTarget}
                  onChange={(e) =>
                    setCampForm({
                      ...campForm,
                      dayTarget: e.target.value as
                        | "all"
                        | "weekday"
                        | "weekend",
                    })
                  }
                >
                  <option value="all">매일</option>
                  <option value="weekday">평일만</option>
                  <option value="weekend">주말만</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-tstart">시간대 시작(선택)</Label>
                <Input
                  id="camp-tstart"
                  type="time"
                  value={campForm.startTime}
                  onChange={(e) =>
                    setCampForm({ ...campForm, startTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-tend">시간대 종료(선택)</Label>
                <Input
                  id="camp-tend"
                  type="time"
                  value={campForm.endTime}
                  onChange={(e) =>
                    setCampForm({ ...campForm, endTime: e.target.value })
                  }
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              시간대를 비워 두면 종일 편성됩니다. 요일·시간대 밖에서는 구좌
              로테이션에서 제외됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCampOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={
                !campForm.name.trim() ||
                !campForm.advertiserId ||
                campCreate.isPending
              }
              onClick={() => campCreate.mutate()}
            >
              {campCreate.isPending ? "만드는 중…" : "만들기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 소재 추가 */}
      <Dialog
        open={creativeFor != null}
        onOpenChange={(open) => {
          if (!open) setCreativeFor(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>소재 추가</DialogTitle>
            <DialogDescription>
              「{creativeFor?.name}」 캠페인에 이미지/영상 소재를 등록합니다.
              업로드 경로(/uploads/…) 또는 https URL을 쓸 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cr-name">소재 이름</Label>
              <Input
                id="cr-name"
                value={creativeForm.name}
                maxLength={120}
                placeholder="예: 신메뉴 15초 영상"
                onChange={(e) =>
                  setCreativeForm({ ...creativeForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-kind">종류</Label>
              <NativeSelect
                id="cr-kind"
                value={creativeForm.kind}
                onChange={(e) =>
                  setCreativeForm({
                    ...creativeForm,
                    kind: e.target.value === "video" ? "video" : "image",
                  })
                }
              >
                <option value="image">이미지</option>
                <option value="video">영상</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-src">미디어 URL</Label>
              <Input
                id="cr-src"
                className="font-mono text-xs"
                value={creativeForm.src}
                placeholder="/uploads/book-videos/….mp4 또는 https://…"
                onChange={(e) =>
                  setCreativeForm({ ...creativeForm, src: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreativeFor(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={
                !creativeForm.name.trim() ||
                !creativeForm.src.trim() ||
                creativeAdd.isPending
              }
              onClick={() => creativeAdd.mutate()}
            >
              {creativeAdd.isPending ? "등록 중…" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 캠페인 삭제 확인 */}
      <AlertDialog
        open={campDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCampDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>캠페인 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              「{campDeleteTarget?.name}」과(와) 소속 소재{" "}
              {campDeleteTarget?.creatives.length ?? 0}개가 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                campDeleteTarget && campDelete.mutate(campDeleteTarget.id)
              }
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 광고주 삭제 확인 */}
      <AlertDialog
        open={advDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAdvDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>광고주 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              「{advDeleteTarget?.name}」과(와) 소속 캠페인{" "}
              {advDeleteTarget?.campaignCount ?? 0}개·소재가 모두 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                advDeleteTarget && advDelete.mutate(advDeleteTarget.id)
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
