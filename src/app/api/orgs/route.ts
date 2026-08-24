// 조직 목록·생성 / 내 권한
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { HttpError } from "@/server/http/http-error";
import {
  requireBearerPayload,
  requireSuperOrgAdmin,
} from "@/server/http/request-auth";
import { OrganizationsService } from "@/server/services/organizations.service";

export async function GET(request: Request) {
  try {
    const actor = await requireBearerPayload(request);
    const orgs = new OrganizationsService();
    const url = new URL(request.url);
    if (url.searchParams.get("capabilities") === "1") {
      const caps = await orgs.capabilities(actor);
      return NextResponse.json(caps);
    }
    const list = await orgs.listForActor(actor);
    return NextResponse.json({ items: list });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperOrgAdmin(request);
    const body = (await request.json()) as {
      name?: string;
      parentId?: number | null;
    };
    if (typeof body.name !== "string") {
      throw new HttpError(400, "name 이 필요합니다.");
    }
    const orgs = new OrganizationsService();
    const created = await orgs.create(actor, {
      name: body.name,
      parentId: body.parentId ?? null,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
