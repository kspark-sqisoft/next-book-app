"use client";

// 디바이스 태그 편집 카드 — 칩 목록 + 입력(Enter/추가 버튼), 저장 시 전체 교체
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type CretaDevice,
  updateCretaDeviceTags,
} from "@/features/creta/creta-api";
import { cretaKeys } from "@/lib/query-keys";

const TAG_MAX_LEN = 40;
const TAGS_MAX = 10;

export function DeviceTagsCard({
  device,
  requireLogin,
}: {
  device: CretaDevice;
  /** 로그인 안 됐으면 토스트를 띄우고 false */
  requireLogin: () => boolean;
}) {
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>(device.tags);
  const [input, setInput] = useState("");
  const dirty =
    tags.length !== device.tags.length ||
    tags.some((t, i) => t !== device.tags[i]);

  const saveMutation = useMutation({
    mutationFn: () => updateCretaDeviceTags(device.id, tags),
    onSuccess: (res) => {
      queryClient.setQueryData(cretaKeys.device(device.id), res);
      void queryClient.invalidateQueries({ queryKey: cretaKeys.devices() });
      setTags(res.tags);
      toast.success("태그를 저장했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTag = () => {
    const tag = input.trim();
    if (!tag) return;
    if (tag.length > TAG_MAX_LEN) {
      toast.error(`태그는 ${TAG_MAX_LEN}자 이하여야 합니다.`);
      return;
    }
    if (tags.includes(tag)) {
      setInput("");
      return;
    }
    if (tags.length >= TAGS_MAX) {
      toast.error(`태그는 디바이스당 최대 ${TAGS_MAX}개입니다.`);
      return;
    }
    setTags([...tags, tag].sort((a, b) => a.localeCompare(b, "ko")));
    setInput("");
  };

  return (
    <Card>
      <CardContent className="space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Tag className="size-4 text-muted-foreground" aria-hidden />
          태그
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          층·매장·방향 같은 태그를 붙이면 디바이스 목록에서 태그 단위로 콘텐츠를
          일괄 배포할 수 있습니다.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.length === 0 ? (
            <span className="text-xs text-muted-foreground">태그 없음</span>
          ) : (
            tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  aria-label={`${tag} 태그 제거`}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={input}
            maxLength={TAG_MAX_LEN}
            placeholder="예: 1층, 강남점, 세로형"
            aria-label="새 태그"
            className="h-8 text-sm"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={!input.trim()}
            onClick={addTag}
          >
            <Plus className="size-3.5" aria-hidden />
            추가
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => {
            if (!requireLogin()) return;
            saveMutation.mutate();
          }}
        >
          {saveMutation.isPending ? "저장 중…" : "태그 저장"}
        </Button>
      </CardContent>
    </Card>
  );
}
