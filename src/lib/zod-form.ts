// Zod issues → { fieldName: message }; 깊은 경로는 첫 키만 사용
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
