import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import { getBearerPayload, requireBearerPayload } from "@/server/http/request-auth";
import { cleanupPostUploadedFiles } from "@/server/posts/cleanup-uploaded";
import { parsePostCreateMultipart } from "@/server/posts/save-post-files";
import {
  PostsService,
  type UploadedPostFile,
} from "@/server/services/posts.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const takeRaw = Number(searchParams.get("take") ?? "12");
    const take = Math.min(50, Math.max(1, takeRaw));
    const search = searchParams.get("search") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const user = await getBearerPayload(request);
    const posts = new PostsService();
    const page = await posts.findPage(
      take,
      user?.sub,
      search ?? undefined,
      category ?? undefined,
      cursor ?? undefined,
    );
    return NextResponse.json(page);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request) {
  let toClean: UploadedPostFile[] = [];
  try {
    const user = await requireBearerPayload(request);
    const fd = await request.formData();
    const parsed = await parsePostCreateMultipart(fd);
    toClean = [...parsed.attachmentFiles, ...parsed.posterFiles];
    const posts = new PostsService();
    const created = await posts.createWithAttachments(
      user.sub,
      parsed.title,
      parsed.content,
      parsed.category,
      parsed.attachmentFiles,
      parsed.posterFiles,
    );
    return NextResponse.json(created);
  } catch (e) {
    await cleanupPostUploadedFiles(toClean);
    return handleRouteError(e);
  }
}
