"use client";

// 플레이리스트 목록: DB 기반 CRUD. 대표 썸네일은 첫 북의 커버.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListVideo, Plus, Repeat, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CretaCoverThumb,
  useCretaCoverThumbs,
} from "@/components/creta/CretaCoverThumb";
import {
  CretaListSearch,
  matchesCretaSearch,
  normalizeCretaSearch,
} from "@/components/creta/CretaListSearch";
import {
  CretaEmptyStateIcon,
  CretaSectionIcon,
} from "@/components/creta/CretaSectionIcon";
import {
  CretaViewToggle,
  useCretaListView,
} from "@/components/creta/CretaViewToggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { canManageOwned } from "@/lib/authz";
import {
  CARD_GRID_COLUMNS,
  GRID_CARD_HOVER,
  LIST_ROW_HOVER,
} from "@/lib/card-hover";
import {
  createCretaPlaylist,
  deleteCretaPlaylist,
  fetchCretaPlaylists,
  sharedWithSummary,
} from "@/lib/creta-api";
import { cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

export function PlaylistListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loop, setLoop] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  /** 보기 형태 — 기존 모양(그리드)이 기본, 디바이스처럼 리스트로 전환 가능 */
  const [view, changeView] = useCretaListView("creta-playlist-view", "grid");

  const { data: playlists, isLoading } = useQuery({
    queryKey: cretaKeys.playlists(),
    queryFn: fetchCretaPlaylists,
  });
  const [search, setSearch] = useState("");
  const query = normalizeCretaSearch(search);
  /** 목록 전체를 받아 두므로 걸러내기는 화면에서 바로 한다 */
  const visiblePlaylists = useMemo(
    () =>
      (playlists ?? []).filter((p) =>
        matchesCretaSearch(query, p.name, p.description),
      ),
    [playlists, query],
  );

  const createMutation = useMutation({
    mutationFn: () => createCretaPlaylist({ name, description, loop }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.playlists() });
      queryClient.setQueryData(cretaKeys.playlist(res.id), res);
      setCreateOpen(false);
      setName("");
      setDescription("");
      router.push(`/playlists/${res.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCretaPlaylist(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.all });
      toast.success("플레이리스트를 삭제했습니다.");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const thumbEntries = useMemo(
    () =>
      (playlists ?? []).map((p) => ({
        key: `playlist-${p.id}`,
        cover: p.cover,
      })),
    [playlists],
  );
  const thumbs = useCretaCoverThumbs(thumbEntries);

  const openCreate = () => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    setCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold">
            <CretaSectionIcon section="playlists" className="size-6" />
            플레이리스트
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            여러 크레타북을 순서대로 묶어 재생
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />새 플레이리스트
        </Button>
      </div>

      <CretaListSearch
        value={search}
        onChange={setSearch}
        placeholder="플레이리스트 이름·설명 검색…"
        label="플레이리스트 검색"
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          저장된 플레이리스트{" "}
          <span className="text-foreground">{visiblePlaylists.length}</span>
          {query ? (
            <span className="ml-1 text-xs">
              / 전체 {playlists?.length ?? 0}
            </span>
          ) : null}
        </p>
        <CretaViewToggle view={view} onChange={changeView} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : visiblePlaylists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <CretaEmptyStateIcon section="playlists" />
            {query
              ? `“${search.trim()}”와 맞는 플레이리스트가 없습니다.`
              : "아직 플레이리스트가 없습니다. “새 플레이리스트”로 첫 묶음을 만들어 보세요."}
          </CardContent>
        </Card>
      ) : view === "list" ? (
        /* 리스트 보기 — 작은 썸네일 + 핵심 정보 한 줄 요약 */
        <div className="space-y-2">
          {visiblePlaylists.map((playlist) => (
            <Card key={playlist.id} className={`py-0 ${LIST_ROW_HOVER}`}>
              <CardContent className="flex items-center gap-3 px-3 py-2.5">
                <Link
                  href={`/playlists/${playlist.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md">
                    <CretaCoverThumb
                      dataUrl={thumbs[`playlist-${playlist.id}`]}
                      title={playlist.name}
                      className="absolute inset-0 size-full rounded-md"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {playlist.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {playlist.description || "설명 없음"}
                    </p>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <ListVideo className="size-3" aria-hidden />
                        {playlist.itemCount}권
                      </span>
                      <span className="truncate">
                        · 작성자 {playlist.owner?.name || "공용"}
                      </span>
                      {playlist.sharedToAll ? (
                        <span className="inline-flex min-w-0 items-center gap-1 text-primary">
                          <Share2 className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            모든 사용자에게 공유됨
                          </span>
                        </span>
                      ) : playlist.sharedWith.length > 0 ? (
                        <span
                          className="inline-flex min-w-0 items-center gap-1 text-primary"
                          title={playlist.sharedWith
                            .map((u) => u.name)
                            .join(", ")}
                        >
                          <Share2 className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            {sharedWithSummary(playlist.sharedWith)}에게 공유됨
                          </span>
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  {playlist.loop ? (
                    <Badge variant="secondary" className="gap-1">
                      <Repeat className="size-3" aria-hidden />
                      순환재생
                    </Badge>
                  ) : (
                    <Badge variant="outline">1회 재생</Badge>
                  )}
                  {canManageOwned(user, playlist.owner?.id ?? null) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${playlist.name} 삭제`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setDeleteTarget({
                          id: playlist.id,
                          name: playlist.name,
                        })
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className={CARD_GRID_COLUMNS}>
          {visiblePlaylists.map((playlist) => (
            <Card
              key={playlist.id}
              className={`group h-full gap-3 py-4 ${GRID_CARD_HOVER}`}
            >
              <CardContent className="space-y-3 px-4">
                <Link
                  href={`/playlists/${playlist.id}`}
                  className="block space-y-3 outline-none"
                >
                  <div className="relative aspect-video overflow-hidden rounded-lg">
                    <CretaCoverThumb
                      dataUrl={thumbs[`playlist-${playlist.id}`]}
                      title={playlist.name}
                      className="absolute inset-0 size-full rounded-lg"
                    />
                    <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      <ListVideo className="mr-1 inline size-3" aria-hidden />
                      {playlist.itemCount}권
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {playlist.name}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {playlist.description || "설명 없음"}
                    </p>
                    <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                      <span className="truncate">
                        작성자 {playlist.owner?.name || "공용"}
                      </span>
                      {playlist.sharedToAll ? (
                        <span className="inline-flex min-w-0 items-center gap-1 text-primary">
                          <Share2 className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            모든 사용자에게 공유됨
                          </span>
                        </span>
                      ) : playlist.sharedWith.length > 0 ? (
                        <span
                          className="inline-flex min-w-0 items-center gap-1 text-primary"
                          title={playlist.sharedWith
                            .map((u) => u.name)
                            .join(", ")}
                        >
                          <Share2 className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            {sharedWithSummary(playlist.sharedWith)}에게 공유됨
                          </span>
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
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
                  {canManageOwned(user, playlist.owner?.id ?? null) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${playlist.name} 삭제`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setDeleteTarget({
                          id: playlist.id,
                          name: playlist.name,
                        })
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 새 플레이리스트 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>새 플레이리스트</DialogTitle>
            <DialogDescription>
              만든 뒤 상세 화면에서 북을 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="playlist-name">이름</Label>
              <Input
                id="playlist-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 매장 오픈 사이니지"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="playlist-desc">설명(선택)</Label>
              <Input
                id="playlist-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="어디에 쓰는 묶음인지"
                maxLength={300}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">순환재생</span>
              <Switch
                checked={loop}
                onCheckedChange={setLoop}
                aria-label="순환재생"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "만드는 중…" : "만들기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>플레이리스트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」을(를) 삭제합니다. 이 플레이리스트를 재생
              중인 디바이스는 재생 소스가 해제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
