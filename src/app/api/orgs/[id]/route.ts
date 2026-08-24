// 조직 이름 변경·삭제
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { HttpError } from "@/server/http/http-error";
import { requireSuperOrgAdmin } from "@/server/http/request-auth";
import { OrganizationsService } from "@/server/services/organizations.service";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requireSuperOrgAdmin(request);
    const { id: raw } = await ctx.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "유효하지 않은 조직 id입니다.");
    }
    const body = (await request.json()) as { name?: string };
    if (typeof body.name !== "string") {
      throw new HttpError(400, "name 이 필요합니다.");
    }
    const orgs = new OrganizationsService();
    const updated = await orgs.rename(actor, id, body.name);
    return NextResponse.json(updated);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const actor = await requireSuperOrgAdmin(request);
    const { id: raw } = await ctx.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "유효하지 않은 조직 id입니다.");
    }
    const orgs = new OrganizationsService();
    await orgs.remove(actor, id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return handleRouteError(e);
  }
}
