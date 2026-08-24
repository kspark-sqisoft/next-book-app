// Route Handler·tRPC: Authorization 헤더에서 액세스 JWT 추출
import { verifyAccessToken } from "@/server/auth/jwt";
import type { JwtPayload } from "@/server/auth/jwt-payload";
import { HttpError } from "@/server/http/http-error";
import { isSuperOrgAdminEmail } from "@/server/orgs/super-org-admin";
import { UserRole } from "@/server/users/user-role";

export async function getBearerPayload(
  request: Request,
): Promise<JwtPayload | null> {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim(); // "Bearer ".length === 7
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

export async function requireBearerPayload(
  request: Request,
): Promise<JwtPayload> {
  const p = await getBearerPayload(request);
  if (!p) {
    throw new HttpError(401, "Unauthorized");
  }
  return p;
}

// 관리자 API용 가드
export async function requireAdmin(request: Request): Promise<JwtPayload> {
  const p = await requireBearerPayload(request);
  if (p.role !== UserRole.Admin) {
    throw new HttpError(403, "Forbidden");
  }
  return p;
}

/** 조직 트리·조직 관리자 지정: SUPER_ORG_ADMIN_EMAILS 만 */
export async function requireSuperOrgAdmin(
  request: Request,
): Promise<JwtPayload> {
  const p = await requireBearerPayload(request);
  if (!isSuperOrgAdminEmail(p.email)) {
    throw new HttpError(403, "조직 슈퍼 관리자만 할 수 있습니다.");
  }
  return p;
}
