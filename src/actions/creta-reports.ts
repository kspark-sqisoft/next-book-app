"use server";

// 재생 리포트(Proof-of-Play) 서버 액션 — 운영 지표라 로그인 필요(재생 경로만 비로그인 허용)
import {
  requireUserFromToken,
  rethrowActionError,
} from "@/actions/session-token";
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
  accessToken: string | null | undefined,
  rangeDays: number,
): Promise<CretaPlayReportPublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaPlayLogService().getReport(
      Math.floor(Number(rangeDays)),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function getCretaDeviceUptimeAction(
  accessToken: string | null | undefined,
  rangeDays: number,
): Promise<CretaDeviceUptimePublic> {
  try {
    await requireUserFromToken(accessToken);
    return await new CretaDeviceUptimeService().getReport(
      Math.floor(Number(rangeDays)),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
