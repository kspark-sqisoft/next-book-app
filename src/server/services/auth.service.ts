import * as bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";

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
  private usersService = new UsersService();

  private db() {
    return getDb();
  }

  async signup(email: string, password: string, name: string) {
    const emailNorm = email.trim();
    if (!name?.trim()) {
      throw new HttpError(400, "이름을 입력해 주세요.");
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

  async signin(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
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
        await tx
          .delete(refreshTokenTable)
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
