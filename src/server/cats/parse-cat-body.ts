// 액션·API에서 공통으로 쓰는 본문 파싱 + 400 에러
import { HttpError } from "@/server/http/http-error";

// 생성 요청: 객체 검증 후 name·age·breed 정규화
export function parseCreateCatBody(value: unknown): {
  name: string;
  age: number;
  breed: string;
} {
  if (value === null || typeof value !== "object") {
    throw new HttpError(400, "JSON body 가 필요합니다.");
  }
  const body = value as Record<string, unknown>; // 이후 필드별 타입 검사
  const nameRaw = body.name;
  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    throw new HttpError(400, "name 은 비어 있지 않은 문자열이어야 합니다.");
  }
  let age = 1; // 생략 시 기본 나이
  if (body.age !== undefined && body.age !== null) {
    const n = Number(body.age); // 문자열 숫자도 허용
    if (!Number.isInteger(n) || n < 0 || n > 40) {
      throw new HttpError(400, "age 는 0~40 정수여야 합니다.");
    }
    age = n;
  }
  const breed =
    typeof body.breed === "string" && body.breed.trim()
      ? String(body.breed).trim()
      : "mixed"; // 빈 품종은 혼합으로 처리
  return { name: nameRaw.trim(), age, breed };
}

// 수정 요청: 최소 한 필드 필수, 부분 필드만 반영
export function parseUpdateCatBody(value: unknown): {
  name?: string;
  age?: number;
  breed?: string;
} {
  if (value === null || typeof value !== "object") {
    throw new HttpError(400, "JSON body 가 필요합니다.");
  }
  const body = value as Record<string, unknown>;
  const hasName = Object.hasOwn(body, "name"); // 키 존재 여부로 “보냈다” 판단
  const hasAge = Object.hasOwn(body, "age");
  const hasBreed = Object.hasOwn(body, "breed");
  if (!hasName && !hasAge && !hasBreed) {
    throw new HttpError(400, "name, age, breed 중 최소 하나는 보내야 합니다.");
  }

  const dto: { name?: string; age?: number; breed?: string } = {};

  if (hasName) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw new HttpError(400, "name 은 비어 있지 않은 문자열이어야 합니다.");
    }
    dto.name = body.name.trim();
  }

  if (hasAge) {
    if (body.age === null) {
      throw new HttpError(400, "age 는 null 일 수 없습니다.");
    }
    const n = Number(body.age);
    if (!Number.isInteger(n) || n < 0 || n > 40) {
      throw new HttpError(400, "age 는 0~40 정수여야 합니다.");
    }
    dto.age = n;
  }

  if (hasBreed) {
    if (typeof body.breed !== "string") {
      throw new HttpError(400, "breed 는 문자열이어야 합니다.");
    }
    const b = body.breed.trim();
    dto.breed = b || "mixed"; // 공백만 오면 mixed
  }

  return dto;
}
