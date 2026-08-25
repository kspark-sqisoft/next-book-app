"use server";

// 재생 리포트(Proof-of-Play) 서버 액션 — 조회 공개(다른 크레타 조회와 동일 정책)
import { rethrowActionError } from "@/actions/session-token";
import {
  CretaPlayLogService,
  type CretaPlayReportPublic,
} from "@/server/services/creta-play-log.service";

const TAG = "creta-reports-actions";

export async function getCretaPlayReportAction(
  rangeDays: number,
): Promise<CretaPlayReportPublic> {
  try {
    return await new CretaPlayLogService().getReport(
      Math.floor(Number(rangeDays)),
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
