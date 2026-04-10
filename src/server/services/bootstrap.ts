// 앱 첫 요청 시 한 번: 역할 기본값·환경변수 부트스트랩 관리자
import { UsersService } from "@/server/services/users.service";

const usersService = new UsersService();
let done = false;

export async function ensureUserBootstraps(): Promise<void> {
  if (done) return;
  done = true;
  await usersService.ensureUserRoleDefaults();
  await usersService.ensureBootstrapAdminRoles();
}
