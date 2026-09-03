"use server";

// 재생 리포트(Proof-of-Play) 서버 액션 — 운영 지표라 로그인 필요(재생 경로만 비로그인 허용)
import { rethrowActionError } from "@/actions/action-guards";
import { requireUser } from "@/server/auth/session";
import {
  type CretaDeviceUptimePublic,
  CretaDeviceUptimeService,
} from "@/server/services/creta-device-uptime.service";
import {
  CretaPlayLogService,
  type CretaPlayReportPublic,
} from "@/server/services/creta-play-log.service";

const TAG = "creta-reports-actions";

export async function getCretaPlayReportAction(
  rangeDays: number,
): Promise<CretaPlayReportPublic> {
  try {
    await requireUser();
    return await new CretaPlayLogService().getReport(
      Math.floor(Number(rangeDays)),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function getCretaDeviceUptimeAction(
  rangeDays: number,
): Promise<CretaDeviceUptimePublic> {
  try {
    await requireUser();
    return await new CretaDeviceUptimeService().getReport(
      Math.floor(Number(rangeDays)),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
