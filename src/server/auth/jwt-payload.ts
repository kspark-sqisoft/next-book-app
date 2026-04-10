import type { UserRole } from "@/server/users/user-role";

// 액세스·리프레시 토큰에 공통으로 넣는 클레임(검증 후 객체)
export type JwtPayload = {
  sub: number; // user.id
  email: string;
  name: string;
  role: UserRole;
};
