// 조직 멤버 목록·추가
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { HttpError } from "@/server/http/http-error";
import { requireBearerPayload } from "@/server/http/request-auth";
import { OrganizationsService } from "@/server/services/organizations.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const actor = await requireBearerPayload(request);
    const { id: raw } = await ctx.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "유효하지 않은 조직 id입니다.");
    }
    const orgs = new OrganizationsService();
    const members = await orgs.listMembers(actor, id);
    return NextResponse.json({ items: members });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const actor = await requireBearerPayload(request);
    const { id: raw } = await ctx.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "유효하지 않은 조직 id입니다.");
    }
    const body = (await request.json()) as {
      email?: string;
      role?: string;
    };
    if (typeof body.email !== "string") {
      throw new HttpError(400, "email 이 필요합니다.");
    }
    const orgs = new OrganizationsService();
    const member = await orgs.addMember(actor, id, {
      email: body.email,
      role: body.role,
    });
    return NextResponse.json(member, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
