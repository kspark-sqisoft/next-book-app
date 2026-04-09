import { HttpError } from "@/server/http/http-error";

export function parseCreateCatBody(value: unknown): {
  name: string;
  age: number;
  breed: string;
} {
  if (value === null || typeof value !== "object") {
    throw new HttpError(400, "JSON body 가 필요합니다.");
  }
  const body = value as Record<string, unknown>;
  const nameRaw = body.name;
  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    throw new HttpError(400, "name 은 비어 있지 않은 문자열이어야 합니다.");
  }
  let age = 1;
  if (body.age !== undefined && body.age !== null) {
    const n = Number(body.age);
    if (!Number.isInteger(n) || n < 0 || n > 40) {
      throw new HttpError(400, "age 는 0~40 정수여야 합니다.");
    }
    age = n;
  }
  const breed =
    typeof body.breed === "string" && body.breed.trim()
      ? String(body.breed).trim()
      : "mixed";
  return { name: nameRaw.trim(), age, breed };
}

export function parseUpdateCatBody(value: unknown): {
  name?: string;
  age?: number;
  breed?: string;
} {
  if (value === null || typeof value !== "object") {
    throw new HttpError(400, "JSON body 가 필요합니다.");
  }
  const body = value as Record<string, unknown>;
  const hasName = Object.hasOwn(body, "name");
  const hasAge = Object.hasOwn(body, "age");
  const hasBreed = Object.hasOwn(body, "breed");
  if (!hasName && !hasAge && !hasBreed) {
    throw new HttpError(
      400,
      "name, age, breed 중 최소 하나는 보내야 합니다.",
    );
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
    dto.breed = b || "mixed";
  }

  return dto;
}
