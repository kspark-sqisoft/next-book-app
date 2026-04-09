import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { AuthService } from "@/server/services/auth.service";
import { ensureUserBootstraps } from "@/server/services/bootstrap";

export async function POST(request: Request) {
  try {
    await ensureUserBootstraps();
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const auth = new AuthService();
    const user = await auth.signup(
      body.email ?? "",
      body.password ?? "",
      body.name ?? "",
    );
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
