"use client";

// 비디오월 목록 — 디바이스를 묶어 동기 재생(시뮬레이션)하는 월을 만들고 관리한다.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Grid2x2, MonitorPlay, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  CretaViewToggle,
  useCretaListView,
} from "@/components/creta/CretaViewToggle";
import { WallSyncThumb } from "@/components/creta/WallSyncThumb";
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
import {
  createCretaWall,
  CRETA_WALL_MODE_LABEL,
  deleteCretaWall,
  fetchCretaWalls,
} from "@/lib/creta-walls-api";
import { cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

export function WallListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  /** 보기 형태 — 기존 모양(그리드)이 기본, 디바이스처럼 리스트로 전환 가능 */
  const [view, changeView] = useCretaListView("creta-wall-view", "grid");

  const { data: walls, isLoading } = useQuery({
    queryKey: cretaKeys.walls(),
    queryFn: fetchCretaWalls,
  });

  const createMutation = useMutation({
    mutationFn: () => createCretaWall({ name }),
    onSuccess: (wall) => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.walls() });
      queryClient.setQueryData(cretaKeys.wall(wall.id), wall);
      setCreateOpen(false);
      setName("");
      toast.success(`「${wall.name}」 비디오월을 만들었습니다.`);
      router.push(`/walls/${wall.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCretaWall(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.walls() });
      setDeleteTarget(null);
      toast.success("비디오월을 삭제했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = walls ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">비디오월</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            디바이스 여러 대를 묶어 타일 분할·동시 재생을 동기화합니다.
            (플레이어 시뮬레이션)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CretaViewToggle view={view} onChange={changeView} />
          <Button
            type="button"
            onClick={() => {
              if (!user) {
                toast.error("로그인이 필요합니다.");
                return;
              }
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            비디오월 만들기
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            아직 비디오월이 없습니다. “비디오월 만들기”로 디바이스를 묶어
            보세요.
          </CardContent>
        </Card>
      ) : view === "list" ? (
        /* 리스트 보기 — 동기 미니 썸네일 + 구성 요약 한 줄 */
        <div className="space-y-2">
          {list.map((wall) => {
            const master = wall.members.find((m) => m.isMaster);
            return (
              <Card
                key={wall.id}
                className="py-0 transition-colors hover:border-primary/50"
              >
                <CardContent className="flex items-center gap-3 px-3 py-2.5">
                  <Link
                    href={`/walls/${wall.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="w-40 shrink-0">
                      <WallSyncThumb wall={wall} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {wall.name}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {CRETA_WALL_MODE_LABEL[wall.mode]}
                        </Badge>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {wall.mode === "tile"
                          ? `${wall.rows}×${wall.cols} 격자 · `
                          : ""}
                        디바이스 {wall.members.length}대 · 슬라이드{" "}
                        {wall.slideSec}초 ·{" "}
                        {wall.mode === "multi"
                          ? "디바이스별 콘텐츠"
                          : (wall.bookTitle ?? "콘텐츠 미지정")}
                      </p>
                      <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                        <span className="truncate">
                          작성자 {wall.ownerName ?? "알 수 없음"}
                        </span>
                        {master ? (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Crown
                              className="size-3 shrink-0 text-amber-500"
                              aria-hidden
                            />
                            <span className="truncate">
                              마스터 {master.deviceName}
                            </span>
                          </span>
                        ) : (
                          <span>마스터 미지정</span>
                        )}
                      </p>
                    </div>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${wall.name} 삭제`}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (!user) {
                        toast.error("로그인이 필요합니다.");
                        return;
                      }
                      setDeleteTarget({ id: wall.id, name: wall.name });
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* 동기 미리보기 썸네일이 잘 보이도록 다른 목록보다 큰 카드(최대 2열, 폭 제한으로 과대 방지) */
        <div className="grid max-w-sm gap-4 lg:max-w-3xl lg:grid-cols-2">
          {list.map((wall) => {
            const master = wall.members.find((m) => m.isMaster);
            return (
              <Card
                key={wall.id}
                className="group relative h-full gap-3 py-4 transition-colors hover:border-primary/50"
              >
                <CardContent className="space-y-3 px-4">
                  <Link
                    href={`/walls/${wall.id}`}
                    className="block space-y-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* 상세의 동기 재생 미리보기와 같은 박자로 도는 미니 썸네일 */}
                    <WallSyncThumb wall={wall} />
                    <div className="flex items-center gap-2">
                      <Grid2x2
                        className="size-5 shrink-0 text-primary"
                        aria-hidden
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {wall.name}
                      </p>
                      <Badge variant="secondary" className="shrink-0">
                        {CRETA_WALL_MODE_LABEL[wall.mode]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {wall.mode === "tile"
                        ? `${wall.rows}×${wall.cols} 격자 · `
                        : ""}
                      디바이스 {wall.members.length}대 · 슬라이드{" "}
                      {wall.slideSec}초
                    </p>
                    <p className="text-xs text-muted-foreground">
                      작성자{" "}
                      <span className="font-medium text-foreground">
                        {wall.ownerName ?? "알 수 없음"}
                      </span>
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {master ? (
                        <>
                          <Crown
                            className="size-3.5 shrink-0 text-amber-500"
                            aria-hidden
                          />
                          <span className="truncate">
                            마스터 {master.deviceName}
                          </span>
                        </>
                      ) : (
                        "마스터 미지정"
                      )}
                    </p>
                    <p className="flex items-center gap-1 text-xs">
                      <MonitorPlay
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="truncate">
                        {wall.mode === "multi"
                          ? "디바이스별 콘텐츠"
                          : (wall.bookTitle ?? "콘텐츠 미지정")}
                      </span>
                    </p>
                  </Link>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${wall.name} 삭제`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (!user) {
                          toast.error("로그인이 필요합니다.");
                          return;
                        }
                        setDeleteTarget({ id: wall.id, name: wall.name });
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>비디오월 만들기</DialogTitle>
            <DialogDescription>
              이름을 정하면 상세 화면에서 모드·디바이스를 구성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wall-name">이름</Label>
            <Input
              id="wall-name"
              value={name}
              maxLength={120}
              placeholder="예: 로비 2×2 월"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) createMutation.mutate();
              }}
            />
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>비디오월 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」을(를) 삭제합니다. 디바이스 자체는 그대로
              남습니다.
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
