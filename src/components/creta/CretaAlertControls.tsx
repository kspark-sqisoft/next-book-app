"use client";

// 긴급 알림(시뮬레이션) 공용 UI — 활성 알림 배너(해제 포함)와 발송 버튼·다이얼로그.
// 실제 플레이어가 없으므로 "재생을 덮는" 효과는 디바이스 화면의 재생 표시 오버라이드로 시뮬레이션한다.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Siren } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isAdminUser } from "@/lib/authz";
import {
  activateCretaAlert,
  CRETA_ALERT_LEVEL_CLASS,
  CRETA_ALERT_LEVELS,
  type CretaAlert,
  type CretaAlertLevel,
  deactivateCretaAlert,
  fetchActiveCretaAlert,
} from "@/lib/creta-alerts-api";
import { formatDateMediumShort } from "@/lib/format-date";
import { cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

const ALERT_POLL_MS = 5000;
const MESSAGE_MAX = 300;

/** 활성 알림 폴링 — 다른 사용자가 발송한 알림도 몇 초 안에 화면에 반영 */
export function useActiveCretaAlert() {
  return useQuery({
    queryKey: cretaKeys.alert(),
    queryFn: fetchActiveCretaAlert,
    refetchInterval: ALERT_POLL_MS,
  });
}

/** 활성 알림 배너 — 메시지·대상·발송자 표시 + 해제 */
export function CretaAlertBanner({ alert }: { alert: CretaAlert }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cls = CRETA_ALERT_LEVEL_CLASS[alert.level];
  const clearMutation = useMutation({
    mutationFn: deactivateCretaAlert,
    onSuccess: () => {
      queryClient.setQueryData(cretaKeys.alert(), null);
      toast.success("긴급 알림을 해제했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 shadow-sm",
        cls.banner,
      )}
    >
      <Siren className="size-5 shrink-0 animate-pulse" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("shrink-0 border-0 text-[11px]", cls.badge)}>
            {alert.level}
          </Badge>
          <p className="min-w-0 flex-1 break-words text-sm font-semibold">
            {alert.message}
          </p>
        </div>
        <p className="mt-0.5 text-[11px] opacity-85">
          대상{" "}
          {alert.allDevices
            ? "모든 디바이스"
            : `디바이스 ${alert.deviceIds.length}대`}
          {alert.createdByName ? ` · ${alert.createdByName}` : ""} ·{" "}
          {formatDateMediumShort(alert.createdAt)}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="shrink-0 bg-white/90 text-black hover:bg-white"
        disabled={clearMutation.isPending}
        onClick={() => {
          if (!user) {
            toast.error("로그인이 필요합니다.");
            return;
          }
          // 서버도 관리자만 허용한다. 프로덕션에서는 서버 액션 오류 상세가 가려져
          // 일반 실패 메시지로 도착하므로, 이유를 여기서 미리 알려 준다.
          if (!isAdminUser(user)) {
            toast.error("긴급 알림 해제는 관리자만 할 수 있습니다.");
            return;
          }
          clearMutation.mutate();
        }}
      >
        해제
      </Button>
    </div>
  );
}

/** 디바이스 재생 화면을 덮는 오버라이드 표시(목록 썸네일·상세 미리보기 공용) */
export function CretaAlertOverlay({
  alert,
  compact = false,
}: {
  alert: CretaAlert;
  /** 목록 썸네일처럼 작은 영역: 메시지 생략, 아이콘만 */
  compact?: boolean;
}) {
  const cls = CRETA_ALERT_LEVEL_CLASS[alert.level];
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-[inherit] p-2 text-center",
        cls.banner,
      )}
      data-testid="creta-alert-overlay"
    >
      <Siren
        className={cn("shrink-0 animate-pulse", compact ? "size-4" : "size-8")}
        aria-hidden
      />
      {compact ? null : (
        <>
          <p className="line-clamp-3 max-w-full break-words text-sm font-bold sm:text-base">
            {alert.message}
          </p>
          <p className="text-[10px] font-medium opacity-85">
            긴급 알림 표시 중 — 해제하면 원래 편성으로 돌아갑니다
          </p>
        </>
      )}
    </div>
  );
}

/** 발송 버튼 + 다이얼로그 — deviceIds 비면 모든 디바이스 대상 */
export function CretaAlertSendButton({
  devices,
}: {
  devices: { id: number; name: string; location: string }[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<CretaAlertLevel>("긴급");
  const [allDevices, setAllDevices] = useState(true);
  const [deviceIds, setDeviceIds] = useState<number[]>([]);

  const sendMutation = useMutation({
    mutationFn: () =>
      activateCretaAlert({
        message,
        level,
        deviceIds: allDevices ? [] : deviceIds,
      }),
    onSuccess: (alert) => {
      queryClient.setQueryData(cretaKeys.alert(), alert);
      setOpen(false);
      setMessage("");
      toast.success("긴급 알림을 발송했습니다. 대상 디바이스 재생을 덮습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDevice = (id: number) =>
    setDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );
  const sendDisabled =
    !message.trim() ||
    (!allDevices && deviceIds.length === 0) ||
    sendMutation.isPending;

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          if (!user) {
            toast.error("로그인이 필요합니다.");
            return;
          }
          if (!isAdminUser(user)) {
            toast.error("긴급 알림 발송은 관리자만 할 수 있습니다.");
            return;
          }
          setOpen(true);
        }}
      >
        <Siren className="size-4" aria-hidden />
        긴급 알림
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Siren className="size-4 text-red-500" aria-hidden />
              긴급 알림 발송
            </DialogTitle>
            <DialogDescription>
              대상 디바이스의 현재 재생을 즉시 이 메시지로 덮습니다. 해제하면
              원래 편성으로 돌아갑니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>수준</Label>
              <div className="grid grid-cols-3 gap-2">
                {CRETA_ALERT_LEVELS.map((lv) => (
                  <Button
                    key={lv}
                    type="button"
                    size="sm"
                    variant={level === lv ? "default" : "outline"}
                    className={cn(
                      level === lv &&
                        lv === "긴급" &&
                        "bg-red-600 text-white hover:bg-red-700",
                      level === lv &&
                        lv === "주의" &&
                        "bg-amber-500 text-black hover:bg-amber-600",
                      level === lv &&
                        lv === "안내" &&
                        "bg-sky-600 text-white hover:bg-sky-700",
                    )}
                    onClick={() => setLevel(lv)}
                  >
                    {lv}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creta-alert-message">메시지</Label>
              <Textarea
                id="creta-alert-message"
                value={message}
                maxLength={MESSAGE_MAX}
                rows={3}
                placeholder="예: 화재 대피 안내 — 가까운 비상구로 침착하게 대피하세요"
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {message.length}/{MESSAGE_MAX}
              </p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">모든 디바이스에 발송</span>
                <Switch
                  checked={allDevices}
                  onCheckedChange={setAllDevices}
                  aria-label="모든 디바이스에 발송"
                />
              </label>
              {!allDevices ? (
                <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
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
                          checked={deviceIds.includes(d.id)}
                          onCheckedChange={() => toggleDevice(d.id)}
                          aria-label={`${d.name} 대상 선택`}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {d.name}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {d.location || "위치 미지정"}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={sendDisabled}
              onClick={() => sendMutation.mutate()}
            >
              {sendMutation.isPending ? "발송 중…" : "발송"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
