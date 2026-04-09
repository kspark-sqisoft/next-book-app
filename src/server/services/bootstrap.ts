import { UsersService } from "@/server/services/users.service";

const usersService = new UsersService();
let done = false;

/** TypeORM 앱의 UsersModule onModuleInit 과 동일: role 기본값·bootstrap admin */
export async function ensureUserBootstraps(): Promise<void> {
  if (done) return;
  done = true;
  await usersService.ensureUserRoleDefaults();
  await usersService.ensureBootstrapAdminRoles();
}
