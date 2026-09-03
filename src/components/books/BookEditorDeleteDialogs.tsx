"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  closePageDelete,
  closeWidgetDelete,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";

/**
 * 위젯·슬라이드 삭제 확인 창. 열림 여부는 스토어가 갖고, 닫기도 스토어 액션이다 —
 * 화면은 "확인했을 때 무엇을 할지"만 넘긴다. 두 화면에 같은 JSX 로 있었다.
 *
 * 두 창 모두 "되돌리기로 복구할 수 있다"고 알린다. 실제로 그렇다 — 제거는 문서 히스토리를
 * 거치므로 Ctrl+Z 한 번이면 돌아온다. 그래서 확인 창이 굳이 무겁지 않다.
 */
export function BookWidgetDeleteDialog({
  kindLabel,
  count,
  onConfirm,
}: {
  /** "텍스트 위젯" / "3개 위젯" 처럼 대상을 부르는 말 */
  kindLabel: string;
  count: number;
  onConfirm: () => void;
}) {
  const open = useBookEditorUiStore((s) => s.widgetDeleteOpen);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closeWidgetDelete();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>위젯을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            이 슬라이드에서 「{kindLabel}」을(를) 제거합니다.
            {count > 1 ? " 선택한 위젯이 모두 삭제됩니다." : ""} 실행 후에는
            되돌리기(Ctrl+Z)로 복구할 수 있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">취소</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            삭제
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BookPageDeleteDialog({
  targetLabel,
  onConfirm,
}: {
  /** "표지" / "슬라이드 3" / "이 슬라이드" */
  targetLabel: string;
  onConfirm: () => void;
}) {
  const open = useBookEditorUiStore((s) => s.pageDeleteOpen);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closePageDelete();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>슬라이드를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            「{targetLabel}」와 이 페이지에 있는 모든 위젯이 제거됩니다.
            되돌리기(Ctrl+Z)로 복구할 수 있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">취소</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            삭제
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
