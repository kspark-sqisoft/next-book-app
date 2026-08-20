"use client";

// 플레이리스트 상세: 북 추가·순서 변경·제거(DB 반영), 전체 재생(첫 북 프레젠테이션),
// 디바이스로 전송(선택한 디바이스의 재생 소스를 이 플레이리스트로 지정).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  MonitorUp,
  Play,
  Plus,
  Repeat,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CretaCoverThumb,
  useCretaCoverThumbs,
} from "@/components/creta/CretaCoverThumb";
import { CretaSourceDialog } from "@/components/creta/CretaSourceDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  addCretaPlaylistItem,
  type CretaPlaylistDetail,
  fetchCretaPlaylist,
  moveCretaPlaylistItem,
  removeCretaPlaylistItem,
  updateCretaDeviceSource,
} from "@/lib/creta-api";
import { goBackOrPush } from "@/lib/navigate-back";
import { cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

export function PlaylistDetailPage() {
  const params = useParams<{ id: string }>();
  const playlistId = Number(params.id);
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const {
    data: playlist,
    isLoading,
    isError,
  } = useQuery({
    queryKey: cretaKeys.playlist(playlistId),
    queryFn: () => fetchCretaPlaylist(playlistId),
    enabled: Number.isFinite(playlistId) && playlistId > 0,
  });

  /** 변경 액션 결과(상세 DTO)로 캐시 갱신 + 목록 무효화 */
  const applyDetail = (res: CretaPlaylistDetail) => {
    queryClient.setQueryData(cretaKeys.playlist(playlistId), res);
    void queryClient.invalidateQueries({ queryKey: cretaKeys.playlists() });
  };

  const addMutation = useMutation({
    mutationFn: (bookId: number) => addCretaPlaylistItem(playlistId, bookId),
    onSuccess: (res) => {
      applyDetail(res);
      setAddOpen(false);
      toast.success("북을 추가했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMutation = useMutation({
    mutationFn: (itemId: number) => removeCretaPlaylistItem(playlistId, itemId),
    onSuccess: applyDetail,
    onError: (e: Error) => toast.error(e.message),
  });
  const moveMutation = useMutation({
    mutationFn: (input: { itemId: number; direction: -1 | 1 }) =>
      moveCretaPlaylistItem(playlistId, input.itemId, input.direction),
    onSuccess: applyDetail,
    onError: (e: Error) => toast.error(e.message),
  });
  const sendMutation = useMutation({
    mutationFn: (deviceId: number) =>
      updateCretaDeviceSource(deviceId, {
        type: "playlist",
        refId: playlistId,
      }),
    onSuccess: (device) => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.devices() });
      queryClient.setQueryData(cretaKeys.device(device.id), device);
      setSendOpen(false);
      toast.success(`「${device.name}」에서 이 플레이리스트를 재생합니다.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = useMemo(() => playlist?.items ?? [], [playlist]);
  const thumbEntries = useMemo(
    () => items.map((it) => ({ key: `pl-item-${it.itemId}`, cover: it.cover })),
    [items],
  );
  const thumbs = useCretaCoverThumbs(thumbEntries);

  const requireLogin = (): boolean => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return false;
    }
    return true;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (isError || !playlist) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          플레이리스트를 찾을 수 없습니다.
        </p>
        <Button asChild variant="outline">
          <Link href="/playlists">
            <ArrowLeft className="size-4" aria-hidden />
            플레이리스트 목록으로
          </Link>
        </Button>
      </div>
    );
  }

  const totalPages = items.reduce((sum, it) => sum + it.pageCount, 0);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => goBackOrPush(router, "/playlists")}
        className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        플레이리스트
      </button>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-bold">
                {playlist.name}
              </h1>
              {playlist.loop ? (
                <Badge variant="secondary" className="gap-1">
                  <Repeat className="size-3" aria-hidden />
                  순환재생
                </Badge>
              ) : (
                <Badge variant="outline">1회 재생</Badge>
              )}
              <Badge variant="outline">{playlist.visibility}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              크레타북 {items.length}개 · 총 {totalPages}페이지
              {playlist.description ? ` · ${playlist.description}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={items.length === 0}
              onClick={() => {
                const first = items[0];
                if (!first) return;
                router.push(`/books/${first.bookId}/preview`);
              }}
            >
              <Play className="size-4" aria-hidden />
              전체 재생
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => requireLogin() && setAddOpen(true)}
            >
              <Plus className="size-4" aria-hidden />북 추가
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => requireLogin() && setSendOpen(true)}
            >
              <MonitorUp className="size-4" aria-hidden />
              디바이스로 전송
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="divide-y divide-border px-0">
          {items.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              담긴 크레타북이 없습니다. “북 추가”로 채워보세요.
            </p>
          ) : (
            items.map((item, index) => (
              <div
                key={item.itemId}
                className="flex items-center gap-4 px-4 py-3 sm:px-6"
              >
                <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <CretaCoverThumb
                  dataUrl={thumbs[`pl-item-${item.itemId}`]}
                  title={item.title}
                  className="h-12 w-20"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/books/${item.bookId}`}
                    className="block truncate text-sm font-medium hover:text-primary"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.pageCount}페이지
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`${item.title} 위로 이동`}
                    disabled={index === 0 || moveMutation.isPending}
                    onClick={() =>
                      requireLogin() &&
                      moveMutation.mutate({
                        itemId: item.itemId,
                        direction: -1,
                      })
                    }
                  >
                    <ArrowUp className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`${item.title} 아래로 이동`}
                    disabled={
                      index === items.length - 1 || moveMutation.isPending
                    }
                    onClick={() =>
                      requireLogin() &&
                      moveMutation.mutate({ itemId: item.itemId, direction: 1 })
                    }
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`${item.title} 빼기`}
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      requireLogin() && removeMutation.mutate(item.itemId)
                    }
                  >
                    <X className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 북 추가 */}
      {addOpen ? (
        <CretaSourceDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          title="북 추가"
          description="플레이리스트 끝에 추가됩니다."
          kinds={["book"]}
          pending={addMutation.isPending}
          onSubmit={(_kind, option) => addMutation.mutate(option.id)}
        />
      ) : null}

      {/* 디바이스로 전송 */}
      {sendOpen ? (
        <CretaSourceDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          title="디바이스로 전송"
          description="선택한 디바이스의 재생 소스를 이 플레이리스트로 지정합니다."
          kinds={["device"]}
          pending={sendMutation.isPending}
          onSubmit={(_kind, option) => sendMutation.mutate(option.id)}
        />
      ) : null}
    </div>
  );
}
