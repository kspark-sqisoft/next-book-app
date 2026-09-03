"use client";

// 광고 관리(1단계) — 광고주 → 캠페인(기간·상태·가중치·CPM) → 소재(이미지/영상) + 기본 노출 리포트.
// 구좌(광고 위젯)는 북 편집기에서 배치하고, 여기의 활성 캠페인 소재가 그 구좌에서 순환 재생된다.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  Film,
  History,
  Image as ImageIcon,
  MonitorSmartphone,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AdMediaThumb } from "@/components/creta/AdMediaThumb";
import { CretaSectionIcon } from "@/components/creta/CretaSectionIcon";
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
  CRETA_AD_AUDIT_KIND_LABEL,
  CRETA_AD_CREATIVE_STATUS_LABEL,
  CRETA_AD_DAY_TARGET_LABEL,
  CRETA_AD_PHASE_LABEL,
  type CretaAdCampaign,
  deleteCretaAdCampaign,
  deleteCretaAdCreative,
  deleteCretaAdvertiser,
  fetchCretaAdAudit,
  fetchCretaAdCampaignReport,
  fetchCretaAdCampaigns,
  fetchCretaAdScreenInventory,
  fetchCretaAdSetting,
  fetchCretaAdvertisers,
  moveCretaAdCreative,
  reviewCretaAdCreative,
  updateCretaAdCampaign,
  updateCretaAdSetting,
  uploadCretaAdMedia,
} from "@/features/creta/creta-ads-api";
import { publicAssetUrl } from "@/lib/api";
import { canManageOwned, isAdminUser } from "@/lib/authz";
import { formatDateMediumShort } from "@/lib/format-date";
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
    void queryClient.invalidateQueries({ queryKey: cretaKeys.adAudit() });
  };

  const admin = isAdminUser(user);
  /** 변경 이력 팝오버 */
  const [auditOpen, setAuditOpen] = useState(false);
  const auditQuery = useQuery({
    queryKey: cretaKeys.adAudit(),
    queryFn: fetchCretaAdAudit,
    enabled: auditOpen,
    refetchInterval: auditOpen ? 10_000 : false,
  });
  const inventoryQuery = useQuery({
    queryKey: cretaKeys.adInventory(),
    queryFn: fetchCretaAdScreenInventory,
    staleTime: 60_000,
  });
  /** 광고 자리가 하나라도 있는 화면만 판매 가능 재고로 본다 */
  const sellableScreens = useMemo(
    () => (inventoryQuery.data ?? []).filter((r) => r.channels.length > 0),
    [inventoryQuery.data],
  );
  /** 캠페인 대상 태그 선택지 — 실제로 광고가 나갈 수 있는 화면의 태그만 */
  const targetTagOptions = useMemo(
    () =>
      [...new Set((inventoryQuery.data ?? []).flatMap((r) => r.tags))].sort(
        (a, b) => a.localeCompare(b, "ko"),
      ),
    [inventoryQuery.data],
  );
  const reviewMutation = useMutation({
    mutationFn: (input: { id: number; decision: "approved" | "rejected" }) =>
      reviewCretaAdCreative(input.id, input.decision),
    onSuccess: (_r, input) => {
      invalidate();
      toast.success(
        input.decision === "approved"
          ? "소재를 승인했습니다 — 편성에 투입됩니다."
          : "소재를 반려했습니다.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const moveMutation = useMutation({
    mutationFn: (input: { id: number; direction: -1 | 1 }) =>
      moveCretaAdCreative(input.id, input.direction),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
  /** 로컬 파일 업로드 — 완료되면 어느 입력을 채울지 target으로 구분 */
  const uploadTargetRef = useRef<"creative" | "house">("creative");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCretaAdMedia(file),
    onSuccess: (res) => {
      if (uploadTargetRef.current === "creative") {
        setCreativeForm((f) => ({ ...f, kind: res.kind, src: res.url }));
      } else {
        setSettingDraft({
          ...settingForm,
          houseKind: res.kind,
          houseSrc: res.url,
        });
      }
      toast.success(
        `${res.kind === "video" ? "영상" : "이미지"}을(를) 업로드했습니다.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const openUpload = (target: "creative" | "house") => {
    if (!requireLogin()) return;
    uploadTargetRef.current = target;
    uploadInputRef.current?.click();
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
    maxPerHour: "0",
    /** 대상 화면(디바이스 태그). 비우면 전체 화면 대상 */
    targetTags: [] as string[],
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
        maxPerHour: Number(campForm.maxPerHour) || null,
        targetTags: campForm.targetTags,
      }),
    onSuccess: () => {
      invalidate();
      setCampOpen(false);
      setCampForm((f) => ({ ...f, name: "", targetTags: [] }));
      toast.success("캠페인을 만들었습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── 대상 화면 편집(카드 팝오버) ──
  const [targetEditFor, setTargetEditFor] = useState<CretaAdCampaign | null>(
    null,
  );
  const targetSave = useMutation({
    mutationFn: (input: { id: number; targetTags: string[] }) =>
      updateCretaAdCampaign(input.id, { targetTags: input.targetTags }),
    onSuccess: () => {
      invalidate();
      setTargetEditFor(null);
      toast.success("대상 화면을 바꿨습니다.");
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
  /** SOV(점유율) 근사 — 라이브 캠페인 가중치 합 대비 비율 */
  const liveWeightTotal = campaigns
    .filter((c) => c.phase === "live")
    .reduce((a, c) => a + c.weight, 0);
  const totalPlays = report.reduce((a, r) => a + r.plays, 0);
  const totalBilling = report.reduce((a, r) => {
    const cpm = campaigns.find((c) => c.id === r.campaignId)?.cpm ?? 0;
    return a + Math.round((r.plays / 1000) * cpm);
  }, 0);

  return (
    <div className="space-y-6">
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) uploadMutation.mutate(f);
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold">
            <CretaSectionIcon section="ads" className="size-6" />
            광고
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            광고주·캠페인·소재를 관리합니다. 활성 캠페인의 소재는 북에 배치한
            광고 위젯(구좌)에서 순환 재생됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 변경 이력 — 버튼 바로 아래 팝오버(감사 로그) */}
          <Popover open={auditOpen} onOpenChange={setAuditOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={auditOpen ? "secondary" : "ghost"}
                className="text-muted-foreground hover:text-foreground"
                aria-pressed={auditOpen}
              >
                <History className="size-4" aria-hidden />
                변경 이력
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={6}
              collisionPadding={8}
              className="z-[240] flex max-h-[70vh] w-96 max-w-[calc(100vw-1rem)] flex-col gap-2 p-3"
              aria-label="광고 변경 이력"
            >
              <p className="text-sm font-semibold">광고 변경 이력</p>
              <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto rounded-md border border-border/60 p-1">
                {(auditQuery.data ?? []).length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    아직 기록된 이력이 없습니다.
                  </p>
                ) : (
                  (auditQuery.data ?? []).map((row) => (
                    <div
                      key={row.id}
                      className="flex items-start gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-muted/50"
                    >
                      <Badge
                        variant="secondary"
                        className="mt-0.5 shrink-0 text-[10px]"
                      >
                        {CRETA_AD_AUDIT_KIND_LABEL[row.entityKind]}
                      </Badge>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {row.entityName}
                        </span>
                        <span className="block text-muted-foreground">
                          {row.detail || row.action}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[10px] text-muted-foreground">
                        {row.actorName}
                        <br />
                        {formatDateMediumShort(row.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
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
            <div className="flex items-center gap-2">
              <Input
                id="set-house-src"
                className="font-mono text-xs"
                value={settingForm.houseSrc}
                placeholder="/uploads/… 또는 https://…"
                onChange={(e) =>
                  setSettingDraft({ ...settingForm, houseSrc: e.target.value })
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={uploadMutation.isPending}
                onClick={() => openUpload("house")}
              >
                <Upload className="size-3.5" aria-hidden />
                {uploadMutation.isPending ? "업로드 중…" : "파일 업로드"}
              </Button>
            </div>
            {/* 지정된 하우스 소재 미리보기 — 보고 지우거나 교체 */}
            {settingForm.houseSrc.trim() ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 p-2">
                <span className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-black/70">
                  <AdMediaThumb
                    key={settingForm.houseSrc}
                    kind={settingForm.houseKind}
                    src={
                      publicAssetUrl(settingForm.houseSrc) ??
                      settingForm.houseSrc
                    }
                    maxWidth={336}
                    className="size-full object-cover"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {settingForm.houseName.trim() || "하우스 광고"}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {settingForm.houseKind === "video" ? "영상" : "이미지"}
                    </span>
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {settingForm.houseSrc}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setSettingDraft({ ...settingForm, houseSrc: "" })
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  지우기
                </Button>
              </div>
            ) : null}
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
                    onClick={() => {
                      if (!requireLogin()) return;
                      // 서버가 advertiser.ownerId로 막는다. 프로덕션에서는 서버 액션
                      // 오류 상세가 가려져 일반 실패 문구로 도착하므로 여기서 먼저 알린다.
                      if (!canManageOwned(user, a.ownerId)) {
                        toast.error(
                          "광고주 소유자·관리자만 삭제할 수 있습니다.",
                        );
                        return;
                      }
                      setAdvDeleteTarget({
                        id: a.id,
                        name: a.name,
                        campaignCount: a.campaignCount,
                      });
                    }}
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
                      {/* 좁은 화면에서 뷰포트를 넘지 않게 줄바꿈 허용 */}
                      <span className="min-w-0 break-keep text-xs tabular-nums text-muted-foreground">
                        {c.startDate} ~ {c.endDate} ·{" "}
                        {CRETA_AD_DAY_TARGET_LABEL[c.dayTarget]}
                        {c.startMin != null && c.endMin != null
                          ? ` ${String(Math.floor(c.startMin / 60)).padStart(2, "0")}:${String(c.startMin % 60).padStart(2, "0")}~${String(Math.floor(c.endMin / 60)).padStart(2, "0")}:${String(c.endMin % 60).padStart(2, "0")}`
                          : ""}{" "}
                        · 가중치 {c.weight}
                        {c.phase === "live" && liveWeightTotal > 0
                          ? ` (점유율 ${Math.round((100 * c.weight) / liveWeightTotal)}%)`
                          : ""}
                        {c.maxPerHour != null
                          ? ` · 시간당 ≤${c.maxPerHour}회`
                          : ""}{" "}
                        · CPM {c.cpm.toLocaleString()}원 · 대상{" "}
                        {c.targetTags.length === 0
                          ? "전체 화면"
                          : c.targetTags.join(" · ")}
                      </span>
                      <Popover
                        open={targetEditFor?.id === c.id}
                        onOpenChange={(open) =>
                          setTargetEditFor(open ? c : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`${c.name} 대상 화면 바꾸기`}
                            title="대상 화면 바꾸기"
                            onClick={(e) => {
                              if (!requireLogin()) e.preventDefault();
                            }}
                          >
                            <MonitorSmartphone
                              className="size-3.5"
                              aria-hidden
                            />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 space-y-2">
                          <p className="text-xs font-medium">대상 화면</p>
                          {targetTagOptions.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              디바이스에 태그가 없습니다 — 전체 화면에 나갑니다.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {targetTagOptions.map((tag) => {
                                const on = c.targetTags.includes(tag);
                                return (
                                  <Button
                                    key={tag}
                                    type="button"
                                    size="sm"
                                    variant={on ? "default" : "outline"}
                                    className="h-7 px-2.5 text-xs"
                                    aria-pressed={on}
                                    disabled={targetSave.isPending}
                                    onClick={() =>
                                      targetSave.mutate({
                                        id: c.id,
                                        targetTags: on
                                          ? c.targetTags.filter(
                                              (t) => t !== tag,
                                            )
                                          : [...c.targetTags, tag],
                                      })
                                    }
                                  >
                                    {tag}
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {c.targetTags.length === 0
                              ? "고르지 않으면 전체 화면에 나갑니다."
                              : "선택한 태그가 붙은 화면에만 나갑니다."}
                          </p>
                        </PopoverContent>
                      </Popover>
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
                                className={cn(
                                  "flex items-center gap-2 rounded-md border p-1 pr-2 text-xs transition-colors",
                                  cr.status === "pending"
                                    ? "border-amber-500/50 bg-amber-500/10"
                                    : cr.status === "rejected"
                                      ? "border-red-500/40 bg-red-500/10 opacity-70"
                                      : "border-border bg-muted/30 hover:border-primary/40",
                                )}
                                title="누르면 순서·심의·삭제 메뉴"
                              >
                                {/* 소재 썸네일 — 영상은 첫 프레임(metadata) 미리보기 */}
                                <span className="relative h-9 w-16 shrink-0 overflow-hidden rounded bg-black/60">
                                  <AdMediaThumb
                                    kind={cr.kind}
                                    src={publicAssetUrl(cr.src) ?? cr.src}
                                    className="size-full object-cover"
                                  />
                                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-0.5 text-[8px] text-white/90">
                                    {cr.kind === "image" ? (
                                      <ImageIcon
                                        className="size-2.5"
                                        aria-hidden
                                      />
                                    ) : (
                                      <Film className="size-2.5" aria-hidden />
                                    )}
                                  </span>
                                </span>
                                <span className="max-w-36 truncate">
                                  {cr.name}
                                </span>
                                {cr.status !== "approved" ? (
                                  <span
                                    className={cn(
                                      "rounded px-1 text-[10px] font-semibold",
                                      cr.status === "pending"
                                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                        : "bg-red-500/20 text-red-600 dark:text-red-400",
                                    )}
                                  >
                                    {CRETA_AD_CREATIVE_STATUS_LABEL[cr.status]}
                                  </span>
                                ) : null}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="bottom"
                              align="start"
                              sideOffset={6}
                              className="w-64 gap-1.5 p-3"
                            >
                              <p className="truncate text-sm font-semibold">
                                {cr.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                심의 상태:{" "}
                                {CRETA_AD_CREATIVE_STATUS_LABEL[cr.status]}
                                {cr.status === "pending" && !admin
                                  ? " — 관리자 승인 후 편성에 투입됩니다."
                                  : ""}
                              </p>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 flex-1 px-2 text-xs"
                                  disabled={moveMutation.isPending}
                                  onClick={() =>
                                    requireLogin() &&
                                    moveMutation.mutate({
                                      id: cr.id,
                                      direction: -1,
                                    })
                                  }
                                >
                                  <ArrowLeft className="size-3.5" aria-hidden />
                                  앞으로
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 flex-1 px-2 text-xs"
                                  disabled={moveMutation.isPending}
                                  onClick={() =>
                                    requireLogin() &&
                                    moveMutation.mutate({
                                      id: cr.id,
                                      direction: 1,
                                    })
                                  }
                                >
                                  뒤로
                                  <ArrowRight
                                    className="size-3.5"
                                    aria-hidden
                                  />
                                </Button>
                              </div>
                              {admin && cr.status !== "approved" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
                                  disabled={reviewMutation.isPending}
                                  onClick={() => {
                                    reviewMutation.mutate({
                                      id: cr.id,
                                      decision: "approved",
                                    });
                                    setCreativeDeleteId(null);
                                  }}
                                >
                                  승인 — 편성 투입
                                </Button>
                              ) : null}
                              {admin && cr.status !== "rejected" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  disabled={reviewMutation.isPending}
                                  onClick={() => {
                                    reviewMutation.mutate({
                                      id: cr.id,
                                      decision: "rejected",
                                    });
                                    setCreativeDeleteId(null);
                                  }}
                                >
                                  반려
                                </Button>
                              ) : null}
                              <div className="mt-1 flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => setCreativeDeleteId(null)}
                                >
                                  닫기
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

      {/* 화면 인벤토리(판매 가능량) — 재고는 "화면 × 시간"으로 센다 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          화면 인벤토리
        </p>
        <Card className="py-0">
          <CardContent className="px-4 py-3">
            {sellableScreens.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                광고를 내보낼 화면이 없습니다. 디바이스에 광고 위젯이 있는 북을
                지정하거나, 재생 소스를 「광고」(전용 루프)로 바꿔 보세요.
              </p>
            ) : (
              <div className="overflow-x-auto">
                {/* 화면 이름·태그가 가장 중요한 정보 — 두 열에 폭을 몰아준다 */}
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="w-[26%] py-2 pr-2 font-medium">화면</th>
                      <th className="w-[22%] px-2 py-2 font-medium">태그</th>
                      <th className="w-[26%] px-2 py-2 font-medium">
                        광고 자리
                      </th>
                      <th className="w-[12%] px-2 py-2 text-right font-medium">
                        캠페인
                      </th>
                      <th className="w-[14%] py-2 pl-2 text-right font-medium">
                        노출 능력
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellableScreens.map((row) => (
                      <tr
                        key={row.deviceId}
                        className="border-b border-border/60 last:border-b-0"
                      >
                        <td className="py-2 pr-2">
                          <span
                            className="block truncate font-medium"
                            title={`${row.deviceName} · ${row.location}`}
                          >
                            {row.deviceName}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {row.online ? row.location : "오프라인"}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className="block truncate text-muted-foreground"
                            title={row.tags.join(" · ")}
                          >
                            {row.tags.length > 0 ? row.tags.join(" · ") : "—"}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className="block truncate text-muted-foreground"
                            title={row.channels
                              .map((c) => `${c.label} ${c.spotSec}초`)
                              .join(" · ")}
                          >
                            {row.channels
                              .map((c) => `${c.label} ${c.spotSec}초`)
                              .join(" · ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {row.liveCampaigns}개
                        </td>
                        <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">
                          {row.hourlyCapacity.toLocaleString()}회/시간
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              시간당 노출 능력 = 화면이 가진 광고 자리마다 3600초 ÷ 표시 시간을
              더한 값. 「캠페인」은 그 화면을 대상으로 하는 라이브 캠페인
              수(대상 미지정 = 전체 화면 캠페인 포함)입니다.
              플레이리스트·스케줄을 거쳐 재생되는 북의 구좌도 포함합니다.
            </p>
          </CardContent>
        </Card>
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
            <div className="space-y-1.5">
              <Label htmlFor="camp-cap">시간당 재생 상한</Label>
              <NativeSelect
                id="camp-cap"
                value={campForm.maxPerHour}
                onChange={(e) =>
                  setCampForm({ ...campForm, maxPerHour: e.target.value })
                }
              >
                <option value="0">무제한</option>
                {[10, 30, 60, 120, 240].map((n) => (
                  <option key={n} value={String(n)}>
                    시간당 최대 {n}회
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label>대상 화면</Label>
              {targetTagOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  디바이스에 태그가 없습니다 — 전체 화면에 나갑니다. 디바이스
                  화면에서 태그를 붙이면 여기서 골라 좁힐 수 있습니다.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {targetTagOptions.map((tag) => {
                      const on = campForm.targetTags.includes(tag);
                      return (
                        <Button
                          key={tag}
                          type="button"
                          size="sm"
                          variant={on ? "default" : "outline"}
                          className="h-7 px-2.5 text-xs"
                          aria-pressed={on}
                          onClick={() =>
                            setCampForm((f) => ({
                              ...f,
                              targetTags: on
                                ? f.targetTags.filter((t) => t !== tag)
                                : [...f.targetTags, tag],
                            }))
                          }
                        >
                          {tag}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {campForm.targetTags.length === 0
                      ? "고르지 않으면 전체 화면에 나갑니다."
                      : `선택한 태그가 붙은 화면에만 나갑니다 — ${campForm.targetTags.join(" · ")}`}
                  </p>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              시간대를 비워 두면 종일 편성됩니다. 요일·시간대 밖이거나 시간당
              상한을 채웠거나, 대상 화면이 아닌 캠페인은 로테이션에서
              제외됩니다.
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
              <div className="flex items-center gap-2">
                <Input
                  id="cr-src"
                  className="font-mono text-xs"
                  value={creativeForm.src}
                  placeholder="/uploads/book-videos/….mp4 또는 https://…"
                  onChange={(e) =>
                    setCreativeForm({ ...creativeForm, src: e.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={uploadMutation.isPending}
                  onClick={() => openUpload("creative")}
                >
                  <Upload className="size-3.5" aria-hidden />
                  {uploadMutation.isPending ? "업로드 중…" : "파일 업로드"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                로컬 PC의 이미지/영상을 올리면 URL과 종류가 자동으로 채워집니다.
              </p>
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
