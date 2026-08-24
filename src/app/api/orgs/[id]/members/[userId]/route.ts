// 조직 멤버 역할 변경·제거
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { HttpError } from "@/server/http/http-error";
import { requireBearerPayload } from "@/server/http/request-auth";
import { OrganizationsService } from "@/server/services/organizations.service";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requireBearerPayload(request);
    const { id: rawOrg, userId: rawUser } = await ctx.params;
    const orgId = Number(rawOrg);
    const userId = Number(rawUser);
    if (!Number.isInteger(orgId) || orgId < 1) {
      throw new HttpError(400, "유효하지 않은 조직 id입니다.");
    }
    if (!Number.isInteger(userId) || userId < 1) {
      throw new HttpError(400, "유효하지 않은 사용자 id입니다.");
    }
    const body = (await request.json()) as { role?: string };
    if (typeof body.role !== "string") {
      throw new HttpError(400, "role 이 필요합니다.");
    }
    const orgs = new OrganizationsService();
    const member = await orgs.setMemberRole(actor, orgId, userId, body.role);
    return NextResponse.json(member);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const actor = await requireBearerPayload(request);
    const { id: rawOrg, userId: rawUser } = await ctx.params;
    const orgId = Number(rawOrg);
    const userId = Number(rawUser);
    if (!Number.isInteger(orgId) || orgId < 1) {
      throw new HttpError(400, "유효하지 않은 조직 id입니다.");
    }
    if (!Number.isInteger(userId) || userId < 1) {
      throw new HttpError(400, "유효하지 않은 사용자 id입니다.");
    }
    const orgs = new OrganizationsService();
    await orgs.removeMember(actor, orgId, userId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return handleRouteError(e);
  }
}
