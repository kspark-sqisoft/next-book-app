/**
 * Zod `safeParse` 실패 시 `issues`를 필드별 메시지 맵으로 바꿉니다.
 * 중첩 경로는 첫 세그먼트만 키로 씁니다(로그인·회원가입·글 에디터와 동일).
 */
export function fieldErrorsFromZodIssues<K extends PropertyKey>(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Partial<Record<K, string>> {
  const fieldErrors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0] as K | undefined;
    if (key !== undefined) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
