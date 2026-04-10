import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// 조건부 클래스 + Tailwind 충돌 시 뒤 클래스 우선
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
