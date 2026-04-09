import type { JwtPayload } from "@/server/auth/jwt-payload";
import { verifyAccessToken } from "@/server/auth/jwt";
import { HttpError } from "@/server/http/http-error";
import { UserRole } from "@/server/users/user-role";

export async function getBearerPayload(
  request: Request,
): Promise<JwtPayload | null> {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
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

export async function requireAdmin(request: Request): Promise<JwtPayload> {
  const p = await requireBearerPayload(request);
  if (p.role !== UserRole.Admin) {
    throw new HttpError(403, "Forbidden");
  }
  return p;
}
