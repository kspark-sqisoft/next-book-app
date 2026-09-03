"use server";

// 긴급 알림 서버 액션: 조회는 공개, 발송·해제는 로그인 필요(디바이스 관리와 동일 정책)
import { rethrowActionError } from "@/actions/action-guards";
import { requireAdmin, requireUser } from "@/server/auth/session";
import {
  type CretaAlertPublic,
  CretaAlertsService,
} from "@/server/services/creta-alerts.service";

const TAG = "creta-alerts-actions";

export async function getActiveCretaAlertAction(): Promise<CretaAlertPublic | null> {
  try {
    return await new CretaAlertsService().getActive();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

/** 발송 — deviceIds가 비어 있으면 모든 디바이스 대상 */
export async function activateCretaAlertAction(input: {
  message: string;
  level?: string;
  deviceIds?: number[] | null;
}): Promise<CretaAlertPublic> {
  try {
    const user = await requireUser();
    return await new CretaAlertsService().activate(
      { id: user.sub, role: user.role },
      {
        message: String(input?.message ?? ""),
        level: input?.level,
        deviceIds: Array.isArray(input?.deviceIds) ? input.deviceIds : null,
      },
    );
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}

export async function deactivateCretaAlertAction(): Promise<void> {
  try {
    // 전 화면 긴급 알림 해제 — 발송과 같은 급의 전역 조작
    await requireAdmin();
    await new CretaAlertsService().deactivate();
  } catch (e) {
    rethrowActionError(e, TAG);
  }
}
