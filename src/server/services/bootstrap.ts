// 앱 첫 요청 시 한 번: 역할 기본값·환경변수 부트스트랩 관리자
import { UsersService } from "@/server/services/users.service";

const usersService = new UsersService();
// Promise를 캐시해 동시 첫 요청 경합을 막고, 실패 시 다음 요청이 재시도할 수 있게 함
let pending: Promise<void> | null = null;

export async function ensureUserBootstraps(): Promise<void> {
  if (!pending) {
    pending = (async () => {
      await usersService.ensureUserRoleDefaults();
      await usersService.ensureBootstrapAdminRoles();
    })().catch((err) => {
      pending = null; // 실패는 캐시하지 않음
      throw err;
    });
  }
  return pending;
}
