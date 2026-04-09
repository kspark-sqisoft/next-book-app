import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { requireBearerPayload } from "@/server/http/request-auth";
import { parseCreateCatBody } from "@/server/cats/parse-cat-body";
import { CatsService } from "@/server/services/cats.service";

function catsClientSnapshot(request: Request) {
  const xf = request.headers.get("x-forwarded-for");
  const ip =
    xf?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "";
  return {
    ip,
    userAgent: request.headers.get("user-agent") ?? "",
  };
}

export async function GET(request: Request) {
  try {
    const cats = new CatsService();
    const list = await cats.findAll();
    return NextResponse.json({
      cats: list,
      _study: { decoratorCatsClientMeta: catsClientSnapshot(request) },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireBearerPayload(request);
    const body = parseCreateCatBody(await request.json());
    const cats = new CatsService();
    const created = await cats.create(body, user.sub);
    return NextResponse.json(created);
  } catch (e) {
    return handleRouteError(e);
  }
}
