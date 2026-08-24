"use client";

// 크레타 > 계정: 내 정보 + 내가 만든/공유받은 북·플레이리스트·스케줄
import { useQuery } from "@tanstack/react-query";
import {
  BookMarked,
  CalendarDays,
  ListVideo,
  Share2,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { publicAssetUrl } from "@/lib/api";
import { type CretaOverviewItem, fetchMyCretaOverview } from "@/lib/creta-api";
import { formatDateMediumShort } from "@/lib/format-date";
import { cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

function ItemList({
  items,
  hrefBase,
  emptyLabel,
  mode,
}: {
  items: CretaOverviewItem[];
  hrefBase: string;
  emptyLabel: string;
  /** owned = 내가 만든(공유 대상 표시), shared = 공유받은(소유자 표시) */
  mode: "owned" | "shared";
}) {
  if (items.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((it) => (
        <li key={it.id}>
          <Link
            href={`${hrefBase}/${it.id}`}
            className="flex items-center justify-between gap-3 px-1 py-2 text-sm transition-colors hover:text-primary"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{it.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {mode === "shared"
                  ? `소유자 ${it.ownerName || "공용"}`
                  : it.sharedWith.length > 0
                    ? `${it.sharedWith.slice(0, 3).join(", ")}${it.sharedWith.length > 3 ? ` 외 ${it.sharedWith.length - 3}명` : ""}에게 공유됨`
                    : "공유 안 함"}
                {" · "}
                {formatDateMediumShort(it.updatedAt)}
              </span>
            </span>
            {mode === "shared" ? (
              <Share2 className="size-3.5 shrink-0 text-primary" aria-hidden />
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Section({
  icon: Icon,
  title,
  owned,
  shared,
  hrefBase,
  unit,
}: {
  icon: typeof BookMarked;
  title: string;
  owned: CretaOverviewItem[];
  shared: CretaOverviewItem[];
  hrefBase: string;
  unit: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            {title}
          </p>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link href={hrefBase}>목록으로</Link>
          </Button>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            내가 만든 {unit}
            <Badge variant="secondary" className="px-1.5 text-[10px]">
              {owned.length}
            </Badge>
          </p>
          <ItemList
            items={owned}
            hrefBase={hrefBase}
            emptyLabel={`아직 만든 ${unit}이(가) 없습니다.`}
            mode="owned"
          />
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            공유받은 {unit}
            <Badge variant="secondary" className="px-1.5 text-[10px]">
              {shared.length}
            </Badge>
          </p>
          <ItemList
            items={shared}
            hrefBase={hrefBase}
            emptyLabel={`공유받은 ${unit}이(가) 없습니다.`}
            mode="shared"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function CretaAccountPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: cretaKeys.overview(user?.sub ?? 0),
    queryFn: fetchMyCretaOverview,
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          내 계정 현황을 보려면 로그인하세요.
        </p>
        <Button asChild>
          <Link href="/login?from=%2Faccount">로그인</Link>
        </Button>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p className="py-10 text-center text-sm text-destructive">
        계정 현황을 불러오지 못했습니다.
      </p>
    );
  }

  const me = data.user;
  const totalOwned =
    data.books.owned.length +
    data.playlists.owned.length +
    data.schedules.owned.length;
  const totalShared =
    data.books.shared.length +
    data.playlists.shared.length +
    data.schedules.shared.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">계정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          내 정보와 권한이 있는 북·플레이리스트·스케줄
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="size-14">
            {me.imageUrl ? (
              <AvatarImage
                src={publicAssetUrl(me.imageUrl) ?? undefined}
                alt=""
              />
            ) : null}
            <AvatarFallback className="text-lg">
              {(me.name || me.email).trim().charAt(0).toUpperCase() || (
                <UserRound className="size-6" aria-hidden />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">{me.name || "이름 없음"}</p>
              <Badge variant={me.role === "admin" ? "default" : "outline"}>
                {me.role === "admin" ? "관리자" : "일반 사용자"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{me.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">내가 만든 항목</p>
              <p className="text-xl font-bold tabular-nums">{totalOwned}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">공유받은 항목</p>
              <p className="text-xl font-bold tabular-nums">{totalShared}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/me">프로필 수정</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          icon={BookMarked}
          title="북"
          owned={data.books.owned}
          shared={data.books.shared}
          hrefBase="/books"
          unit="북"
        />
        <Section
          icon={ListVideo}
          title="플레이리스트"
          owned={data.playlists.owned}
          shared={data.playlists.shared}
          hrefBase="/playlists"
          unit="플레이리스트"
        />
        <Section
          icon={CalendarDays}
          title="스케줄"
          owned={data.schedules.owned}
          shared={data.schedules.shared}
          hrefBase="/schedules"
          unit="스케줄"
        />
      </div>
    </div>
  );
}
