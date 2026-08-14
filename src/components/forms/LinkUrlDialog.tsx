"use client";

// 리치 에디터 공용: window.prompt 대신 앱 스타일(shadcn Dialog)로 링크 URL 입력
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 열릴 때 입력창에 채울 기존 링크(없으면 https://) */
  initialUrl?: string;
  /** 빈 문자열 = 링크 제거 */
  onSubmit: (url: string) => void;
};

export function LinkUrlDialog({
  open,
  onOpenChange,
  initialUrl,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>링크</DialogTitle>
          <DialogDescription>
            선택한 글자에 걸 주소를 입력하세요.
          </DialogDescription>
        </DialogHeader>
        {/* 닫히면 언마운트되므로 열 때마다 초기값으로 리셋됨(effect 불필요) */}
        <LinkUrlForm
          initialUrl={initialUrl}
          onApply={(url) => {
            onSubmit(url);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LinkUrlForm({
  initialUrl,
  onApply,
  onCancel,
}: {
  initialUrl?: string;
  onApply: (url: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(() => initialUrl?.trim() || "https://");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(url.trim());
      }}
    >
      <Input
        autoFocus
        className="font-mono text-sm"
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <DialogFooter className="gap-2 sm:gap-1.5">
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => onApply("")}
        >
          링크 제거
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit">적용</Button>
      </DialogFooter>
    </form>
  );
}
