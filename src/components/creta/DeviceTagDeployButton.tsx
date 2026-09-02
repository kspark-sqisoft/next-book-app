"use client";

// 태그 일괄 배포 — 태그를 고르고 콘텐츠(북/플레이리스트/스케줄)를 선택하면
// 그 태그가 붙은 모든 디바이스의 재생 소스를 한 번에 바꾼다.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type CretaPickerKind,
  CretaSourcePicker,
} from "@/components/creta/CretaSourcePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { isAdminUser } from "@/lib/authz";
import { assignCretaSourceByTag, type CretaDevice } from "@/lib/creta-api";
import { cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

const KINDS: Exclude<CretaPickerKind, "device">[] = [
  "book",
  "playlist",
  "schedule",
];
const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
  book: "크레타북",
  playlist: "플레이리스트",
  schedule: "스케줄",
};

export function DeviceTagDeployButton({ devices }: { devices: CretaDevice[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("book");
  const [selected, setSelected] = useState<{
    id: number;
    title: string;
  } | null>(null);

  /** 태그 → 디바이스 수(가나다순) — 디바이스 목록에서 파생 */
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of devices) {
      for (const t of d.tags) map.set(t, (map.get(t) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "ko"));
  }, [devices]);

  const deployMutation = useMutation({
    mutationFn: () =>
      assignCretaSourceByTag(tag, { type: kind, refId: selected!.id }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: cretaKeys.devices() });
      for (const d of res.devices) {
        queryClient.setQueryData(cretaKeys.device(d.id), d);
      }
      setOpen(false);
      setSelected(null);
      toast.success(
        `「${tag}」 태그 디바이스 ${res.count}대에 「${selected?.title}」을(를) 배포했습니다.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          if (!user) {
            toast.error("로그인이 필요합니다.");
            return;
          }
          // 태그가 붙은 모든 화면의 송출을 한 번에 바꾸므로 서버가 관리자만 허용한다
          if (!isAdminUser(user)) {
            toast.error("태그 일괄 배포는 관리자만 할 수 있습니다.");
            return;
          }
          if (tagCounts.length === 0) {
            toast.info(
              "먼저 디바이스 상세에서 태그를 붙이세요. 태그 단위로 일괄 배포할 수 있습니다.",
            );
            return;
          }
          setTag((cur) => cur || (tagCounts[0]?.[0] ?? ""));
          setOpen(true);
        }}
      >
        <Tags className="size-4" aria-hidden />
        태그 배포
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-4 text-muted-foreground" aria-hidden />
              태그 일괄 배포
            </DialogTitle>
            <DialogDescription>
              선택한 태그가 붙은 모든 디바이스의 재생 소스를 한 번에 바꿉니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="deploy-tag">대상 태그</Label>
              <NativeSelect
                id="deploy-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              >
                {tagCounts.map(([t, n]) => (
                  <option key={t} value={t}>
                    {t} — 디바이스 {n}대
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => (
                <Button
                  key={k}
                  type="button"
                  variant={kind === k ? "default" : "outline"}
                  onClick={() => {
                    setKind(k);
                    setSelected(null);
                  }}
                >
                  {KIND_LABEL[k]}
                </Button>
              ))}
            </div>
            <CretaSourcePicker
              kind={kind}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={!tag || !selected || deployMutation.isPending}
              onClick={() => deployMutation.mutate()}
            >
              {deployMutation.isPending ? "배포 중…" : "일괄 배포"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
