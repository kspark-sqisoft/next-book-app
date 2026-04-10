import { z } from "zod";

// 이메일·비밀번호 클라이언트 검증(서버도 별도 검증)
export const loginSchema = z.object({
  email: z.pipe(
    z.string().min(1, "이메일을 입력해 주세요."),
    z.email("이메일 형식이 올바르지 않습니다."),
  ),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요."),
  email: z.pipe(
    z.string().min(1, "이메일을 입력해 주세요."),
    z.email("이메일 형식이 올바르지 않습니다."),
  ),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

const POST_CONTENT_MAX = 200_000; // HTML 포함 최대 길이

// 태그 제거 후 실질 글자 수(빈 본문 방지)
function postContentPlainLen(html: string): number {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

const postCategoryEnum = z.enum(["tech", "life", "study", "chat", "general"]);

// 첨부·썸네일은 폼 밖 state; 여기선 텍스트 필드만
export const postEditorSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(200, "제목은 200자 이하여야 합니다."),
  content: z
    .string()
    .max(POST_CONTENT_MAX, "본문이 너무 깁니다.")
    .refine((s) => postContentPlainLen(s) > 0, "본문을 입력해 주세요."),
  category: postCategoryEnum,
});

export type PostEditorFormValues = z.infer<typeof postEditorSchema>;

// Cats 등록 폼: 서버 parseCreateCatBody·DTO와 동일한 범위로 맞춤
export const catCreateSchema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력해 주세요."), // 필수
    breed: z.string(), // 빈 문자열 허용 → 서버에서 mixed
    age: z.string(), // 빈 문자열 = 서버 기본 나이 1
  })
  .superRefine((val, ctx) => {
    const t = val.age.trim(); // 비우면 refine 스킵
    if (t === "") return; // 서버가 기본값 처리
    const n = Number(t); // 숫자 아닌 문자열은 NaN
    if (!Number.isInteger(n) || n < 0 || n > 40) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "나이는 0~40 정수이거나 비워 두세요.",
        path: ["age"],
      });
    }
  });

// 폼 필드 키 타입(에러 맵 등에 사용)
export type CatCreateFormValues = z.infer<typeof catCreateSchema>;
