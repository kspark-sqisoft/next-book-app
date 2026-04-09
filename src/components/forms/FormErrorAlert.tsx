import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Props = {
  message: string | null | undefined;
  title?: string;
  className?: string;
};

export function FormErrorAlert({ message, title = "오류", className }: Props) {
  if (!message) return null;
  return (
    <Alert variant="destructive" className={className}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
