import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireAdmin } from "@/server/http/request-auth";
import { UsersService } from "@/server/services/users.service";
import { UserRole } from "@/server/users/user-role";
import { HttpError } from "@/server/http/http-error";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as {
      email?: string;
      role?: string;
    };
    if (body.role !== UserRole.User && body.role !== UserRole.Admin) {
      throw new HttpError(400, "role은 user 또는 admin 이어야 합니다.");
    }
    const users = new UsersService();
    const result = await users.setRoleByEmail(body.email ?? "", body.role);
    return NextResponse.json(result);
  } catch (e) {
    return handleRouteError(e);
  }
}
