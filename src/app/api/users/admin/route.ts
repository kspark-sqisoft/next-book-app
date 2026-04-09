import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireAdmin } from "@/server/http/request-auth";
import { UsersService } from "@/server/services/users.service";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const users = new UsersService();
    const list = await users.listUsersForAdmin();
    return NextResponse.json(list);
  } catch (e) {
    return handleRouteError(e);
  }
}
