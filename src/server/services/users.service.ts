import "server-only";

// 사용자 프로필·관리자 목록·부트스트랩 admin 이메일
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

import { eq, sql } from "drizzle-orm";

import { getDb, user as userTable } from "@/server/db";
import {
  AVATARS_SUBDIR,
  BOOTSTRAP_ADMIN_EMAILS,
  UPLOAD_ROOT,
} from "@/server/env";
import { HttpError } from "@/server/http/http-error";
import { UserRole } from "@/server/users/user-role";

export type MePublic = {
  sub: number;
  email: string;
  name: string;
  imageUrl: string | null;
  role: UserRole;
};

export type AdminSetRoleResult = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
};

export type AdminUserListItem = {
  id: number;
  email: string;
  name: string;
  imageUrl: string | null;
  role: UserRole;
};

export class UsersService {
  private db() {
    return getDb();
  }

  private avatarPublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${AVATARS_SUBDIR}/${filename}`;
  }

  private async unlinkAvatar(filename: string | null): Promise<void> {
    if (!filename) return;
    const full = join(UPLOAD_ROOT, AVATARS_SUBDIR, filename);
    if (existsSync(full)) {
      await unlink(full);
    }
  }

  toMePublic(u: {
    id: number;
    email: string;
    name: string;
    profileImageFilename: string | null;
    role: string | null;
  }): MePublic {
    const r =
      u.role === UserRole.Admin || u.role === "admin"
        ? UserRole.Admin
        : UserRole.User;
    return {
      sub: u.id,
      email: u.email,
      name: u.name,
      imageUrl: this.avatarPublicUrl(u.profileImageFilename),
      role: r,
    };
  }

  async findByEmail(email: string) {
    const db = this.db();
    // 부트스트랩 관리자 매칭(LOWER)과 동일 기준 — 대소문자만 다른 중복 계정·권한 오지정 방지
    const normalized = email.trim().toLowerCase();
    return db.query.user.findFirst({
      where: sql`LOWER(TRIM(${userTable.email})) = ${normalized}`,
    });
  }

  async findByIdForAuth(id: number) {
    const db = this.db();
    return db.query.user.findFirst({
      where: eq(userTable.id, id),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }

  async findByIdOrFail(id: number) {
    const db = this.db();
    const u = await db.query.user.findFirst({
      where: eq(userTable.id, id),
    });
    if (!u) throw new HttpError(404, "Not Found");
    return u;
  }

  async create(email: string, password: string, name: string) {
    const db = this.db();
    const [row] = await db
      .insert(userTable)
      .values({
        email,
        password,
        name: name.trim(),
        role: UserRole.User,
      })
      .returning();
    return row;
  }

  /**
   * 관리자 강등을 "남은 관리자 수 > 1" 조건과 같은 문장으로 수행 —
   * 카운트 조회와 UPDATE 사이의 경합(동시 강등으로 관리자 0명)을 DB 레벨에서 차단.
   * 강등이 실제로 일어났으면 true, 마지막 관리자여서 거부되면 throw.
   */
  private async demoteAdminGuarded(userId: number): Promise<void> {
    const db = this.db();
    const rows = await db
      .update(userTable)
      .set({ role: UserRole.User })
      .where(
        sql`${userTable.id} = ${userId} AND ${userTable.role} = ${UserRole.Admin} AND (SELECT count(*) FROM ${userTable} WHERE ${userTable.role} = ${UserRole.Admin}) > 1`,
      )
      .returning({ id: userTable.id });
    if (rows.length === 0) {
      // 이미 일반 사용자면 통과, 마지막 관리자면 거부
      const u = await db.query.user.findFirst({
        where: eq(userTable.id, userId),
        columns: { role: true },
      });
      if (u && u.role === UserRole.Admin) {
        throw new HttpError(
          400,
          "마지막 관리자입니다. 역할을 일반 사용자로 바꿀 수 없습니다.",
        );
      }
    }
  }

  async listUsersForAdmin(): Promise<AdminUserListItem[]> {
    const db = this.db();
    // password 해시는 목록에 필요 없음 — 프로젝션으로 앱 메모리 유입 자체를 차단
    const rows = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
        profileImageFilename: userTable.profileImageFilename,
        role: userTable.role,
      })
      .from(userTable)
      .orderBy(userTable.id);
    return rows.map((u) => {
      const fn = u.profileImageFilename;
      const trimmed =
        fn != null && String(fn).trim() !== "" ? String(fn).trim() : null;
      const role =
        u.role === UserRole.Admin || u.role === "admin"
          ? UserRole.Admin
          : UserRole.User;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        imageUrl: this.avatarPublicUrl(trimmed),
        role,
      };
    });
  }

  async setRoleByEmail(
    rawEmail: string,
    newRole: UserRole,
  ): Promise<AdminSetRoleResult> {
    const normalized = rawEmail.trim().toLowerCase();
    if (!normalized) {
      throw new HttpError(400, "email이 필요합니다.");
    }
    if (newRole !== UserRole.User && newRole !== UserRole.Admin) {
      throw new HttpError(400, "role은 user 또는 admin 이어야 합니다.");
    }

    const db = this.db();
    const [target] = await db
      .select()
      .from(userTable)
      .where(sql`LOWER(TRIM(${userTable.email})) = ${normalized}`)
      .limit(1);

    if (!target) {
      throw new HttpError(404, "해당 이메일의 사용자를 찾을 수 없습니다.");
    }

    const curRole =
      target.role === UserRole.Admin || target.role === "admin"
        ? UserRole.Admin
        : UserRole.User;

    if (curRole === newRole) {
      return {
        id: target.id,
        email: target.email,
        name: target.name,
        role: curRole,
      };
    }

    if (curRole === UserRole.Admin && newRole === UserRole.User) {
      await this.demoteAdminGuarded(target.id);
    } else {
      await db
        .update(userTable)
        .set({ role: newRole })
        .where(eq(userTable.id, target.id));
    }

    return {
      id: target.id,
      email: target.email,
      name: target.name,
      role: newRole,
    };
  }

  async ensureUserRoleDefaults(): Promise<void> {
    const db = this.db();
    await db
      .update(userTable)
      .set({ role: UserRole.User })
      .where(sql`(${userTable.role} IS NULL OR TRIM(${userTable.role}) = '')`);
  }

  async ensureBootstrapAdminRoles(): Promise<void> {
    const emails = BOOTSTRAP_ADMIN_EMAILS;
    if (emails.length === 0) return;
    const db = this.db();
    for (const e of emails) {
      await db
        .update(userTable)
        .set({ role: UserRole.Admin })
        .where(sql`LOWER(${userTable.email}) = ${e}`);
    }
  }

  async getMeProfile(userId: number): Promise<MePublic> {
    const user = await this.findByIdOrFail(userId);
    return this.toMePublic(user);
  }

  async updateMyProfile(
    userId: number,
    body: {
      newImageFilename?: string;
      removeImage?: boolean;
      name?: string;
      role?: UserRole;
    },
  ): Promise<MePublic> {
    const user = await this.findByIdOrFail(userId);
    let touched = false;

    const curRole =
      user.role === UserRole.Admin || user.role === "admin"
        ? UserRole.Admin
        : UserRole.User;

    if (body.role !== undefined) {
      if (body.role === UserRole.Admin) {
        if (curRole !== UserRole.Admin) {
          throw new HttpError(
            403,
            "본인을 관리자로 올리려면 다른 관리자가 내 정보의 «다른 사용자 역할»에서 지정해야 합니다.",
          );
        }
      } else if (body.role === UserRole.User) {
        if (curRole === UserRole.Admin) {
          await this.demoteAdminGuarded(user.id);
          user.role = UserRole.User;
          touched = true;
        }
      }
    }

    if (body.name !== undefined) {
      const n = body.name.trim();
      if (!n) {
        throw new HttpError(400, "이름은 비울 수 없습니다.");
      }
      if (n.length > 100) {
        throw new HttpError(400, "이름은 100자 이하로 입력해 주세요.");
      }
      user.name = n;
      touched = true;
    }

    if (body.newImageFilename) {
      await this.unlinkAvatar(user.profileImageFilename);
      user.profileImageFilename = body.newImageFilename;
      touched = true;
    } else if (body.removeImage) {
      await this.unlinkAvatar(user.profileImageFilename);
      user.profileImageFilename = null;
      touched = true;
    }

    if (!touched) {
      if (body.role !== undefined) {
        return this.toMePublic(user);
      }
      throw new HttpError(400, "변경할 내용이 없습니다.");
    }

    const db = this.db();
    await db
      .update(userTable)
      .set({
        name: user.name,
        role: user.role ?? UserRole.User,
        profileImageFilename: user.profileImageFilename,
      })
      .where(eq(userTable.id, userId));

    const fresh = await this.findByIdOrFail(userId);
    return this.toMePublic(fresh);
  }
}
