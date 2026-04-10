// File이 들어온 필드는 빈 문자열로 처리
export function formDataGetString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
