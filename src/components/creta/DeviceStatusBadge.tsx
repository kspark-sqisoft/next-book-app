import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  CRETA_DEVICE_STATUS_LABEL,
  type CretaDevice,
  cretaDeviceStatus,
} from "@/lib/creta-api";

/** 디바이스 상태 배지 — 온라인(초록)·비정상(빨강+아이콘)·오프라인(회색). 색만이 아니라 글자·아이콘으로도 구분 */
export function DeviceStatusBadge({
  device,
}: {
  device: Pick<CretaDevice, "online" | "health">;
}) {
  const status = cretaDeviceStatus(device);
  if (status === "error") {
    return (
      <Badge className="gap-1 bg-red-500/15 text-red-600 dark:text-red-400">
        {/* 목록에서 바로 눈에 띄도록 깜빡임 — 모션 감소 설정에서는 정지 */}
        <AlertTriangle
          className="size-3 animate-pulse motion-reduce:animate-none"
          aria-hidden
        />
        {CRETA_DEVICE_STATUS_LABEL.error}
      </Badge>
    );
  }
  if (status === "online") {
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        {CRETA_DEVICE_STATUS_LABEL.online}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <span
        className="size-1.5 rounded-full bg-muted-foreground/50"
        aria-hidden
      />
      {CRETA_DEVICE_STATUS_LABEL.offline}
    </Badge>
  );
}
