type Props = {
  message: string | null | undefined;
};

export function FormFieldError({ message }: Props) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}
