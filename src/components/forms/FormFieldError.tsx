// 필드 아래 한 줄 에러 텍스트
type Props = {
  message: string | null | undefined;
};

export function FormFieldError({ message }: Props) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}
