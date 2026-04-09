import type { UserRole } from "@/server/users/user-role";

export type JwtPayload = {
  sub: number;
  email: string;
  name: string;
  role: UserRole;
};
