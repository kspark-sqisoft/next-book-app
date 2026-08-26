// 가입·로그인·리프레시 로테이션·bcrypt·JWT
import * as bcrypt from "bcrypt";
import { and, eq, lt } from "drizzle-orm";

import { hashRefreshToken } from "@/server/auth/hash-refresh";
import {
  decodeRefreshExp,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/server/auth/jwt";
import type { JwtPayload } from "@/server/auth/jwt-payload";
import { getDb, refreshToken as refreshTokenTable } from "@/server/db";
import { HttpError } from "@/server/http/http-error";
import { UsersService } from "@/server/services/users.service";
import { UserRole } from "@/server/users/user-role";

export class AuthService {
  /** 회전된 리프레시 토큰의 재사용 유예(ms) — 동시 갱신 경쟁이 로그아웃으로 번지지 않는 최소 폭 */
  private static readonly ROTATION_GRACE_MS = 60_000;

  private usersService = new UsersService();

  private db() {
    return getDb();
  }

  async signup(email: string, password: string, name: string) {
    // 클라이언트 zod 스키마와 별개로 서버에서도 검증 — API 직접 호출로 빈 비밀번호 계정이 생기지 않게
    const emailNorm = email.trim().toLowerCase();
    if (
      !emailNorm ||
      emailNorm.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)
    ) {
      throw new HttpError(400, "이메일 형식이 올바르지 않습니다.");
    }
    if (typeof password !== "string" || password.length < 6) {
      throw new HttpError(400, "비밀번호는 6자 이상이어야 합니다.");
    }
    if (password.length > 200) {
      throw new HttpError(400, "비밀번호가 너무 깁니다.");
    }
    const trimmedName = name?.trim() ?? "";
    if (!trimmedName) {
      throw new HttpError(400, "이름을 입력해 주세요.");
    }
    if (trimmedName.length > 100) {
      throw new HttpError(400, "이름은 100자 이하로 입력해 주세요.");
    }
    const existing = await this.usersService.findByEmail(emailNorm);
    if (existing) {
      throw new HttpError(409, "이미 가입된 이메일입니다.");
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.usersService.create(emailNorm, hashed, name);
    return user;
  }

  private async persistRefreshToken(
    userId: number,
    refreshToken: string,
  ): Promise<void> {
    const expiresAt = decodeRefreshExp(refreshToken);
    const db = this.db();
    await db.insert(refreshTokenTable).values({
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    });
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const db = this.db();
    await db
      .delete(refreshTokenTable)
      .where(eq(refreshTokenTable.tokenHash, hashRefreshToken(rawToken)));
  }

  // 미존재 계정도 bcrypt 비교 비용을 지불시켜 응답 시간으로 계정 존재를 추측하지 못하게 함
  private static readonly DUMMY_HASH =
    "$2b$10$C6UzMDM.H6dfI/f/IKcEeO7ZoLCkzK7qXKcnwm0eEC1EaBTU0uW3S";

  async signin(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      await bcrypt.compare(password, AuthService.DUMMY_HASH);
      throw new HttpError(401, "Unauthorized");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new HttpError(401, "Unauthorized");
    }
    const role =
      user.role === UserRole.Admin || user.role === "admin"
        ? UserRole.Admin
        : UserRole.User;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role,
    };
    const access_token = await signAccessToken(payload);
    const refresh_token = await signRefreshToken(payload);
    await this.persistRefreshToken(user.id, refresh_token);
    return { access_token, refresh_token };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      throw new HttpError(401, "Unauthorized");
    }

    const user = await this.usersService.findByEmail(payload.email);
    const subId =
      typeof payload.sub === "string"
        ? parseInt(payload.sub as unknown as string, 10)
        : Number(payload.sub);
    if (!user || !Number.isFinite(subId) || user.id !== subId) {
      throw new HttpError(401, "Unauthorized");
    }

    const incomingHash = hashRefreshToken(refreshToken);
    const now = Date.now();
    const db = this.db();

    // 갱신 때마다 이 사용자의 만료 행을 정리 — 로그인/갱신 반복으로 무한 누적되는 것 방지
    await db
      .delete(refreshTokenTable)
      .where(
        and(
          eq(refreshTokenTable.userId, user.id),
          lt(refreshTokenTable.expiresAt, new Date(now)),
        ),
      );

    try {
      const newRefreshToken = await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(refreshTokenTable)
          .where(
            and(
              eq(refreshTokenTable.tokenHash, incomingHash),
              eq(refreshTokenTable.userId, user.id),
            ),
          )
          .limit(1);
        if (!row || row.expiresAt.getTime() < now) {
          throw new HttpError(401, "Unauthorized");
        }
        // 즉시 삭제하지 않고 짧은 유예를 남긴다 — 여러 탭이 동시에 갱신하거나
        // 타임아웃 재시도로 옛 토큰이 한 번 더 오는 경우 로그아웃되지 않게(회전 경쟁 완화).
        // 유예는 줄이기만 하고 늘리지 않는다.
        const graceExpiry = new Date(
          Math.min(
            row.expiresAt.getTime(),
            now + AuthService.ROTATION_GRACE_MS,
          ),
        );
        await tx
          .update(refreshTokenTable)
          .set({ expiresAt: graceExpiry })
          .where(eq(refreshTokenTable.id, row.id));

        const role =
          user.role === UserRole.Admin || user.role === "admin"
            ? UserRole.Admin
            : UserRole.User;
        const nextPayload: JwtPayload = {
          sub: user.id,
          email: user.email,
          name: user.name,
          role,
        };
        const next = await signRefreshToken(nextPayload);
        const expiresAt = decodeRefreshExp(next);
        await tx.insert(refreshTokenTable).values({
          userId: user.id,
          tokenHash: hashRefreshToken(next),
          expiresAt,
        });
        return next;
      });

      const role =
        user.role === UserRole.Admin || user.role === "admin"
          ? UserRole.Admin
          : UserRole.User;
      const access_token = await signAccessToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role,
      });
      return { access_token, refresh_token: newRefreshToken };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(401, "Unauthorized");
    }
  }
}
