/** `FormData.get` 결과를 안전하게 문자열로만 읽습니다. */
export function formDataGetString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
