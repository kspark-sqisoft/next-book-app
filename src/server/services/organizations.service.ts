import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db";
import { organization, organizationMember, user } from "@/server/db/schema";
import { AVATARS_SUBDIR } from "@/server/env";
import { HttpError } from "@/server/http/http-error";
import {
  normalizeOrgMemberRole,
  OrgMemberRole,
} from "@/server/orgs/org-member-role";
import { isSuperOrgAdminEmail } from "@/server/orgs/super-org-admin";

export type OrgListItem = {
  id: number;
  name: string;
  parentId: number | null;
  memberCount: number;
};

export type OrgMemberItem = {
  userId: number;
  email: string;
  name: string;
  imageUrl: string | null;
  role: "admin" | "member";
};

export type OrgCapabilities = {
  isSuperOrgAdmin: boolean;
  /** 조직 관리자(admin)로 속한 조직 id */
  adminOrganizationIds: number[];
  /** 멤버로 속한 조직 id(관리자 포함) */
  memberOrganizationIds: number[];
};

function avatarPublicUrl(filename: string | null): string | null {
  if (!filename) return null;
  return `/uploads/${AVATARS_SUBDIR}/${filename}`;
}

function normalizeOrgName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new HttpError(400, "조직 이름을 입력해 주세요.");
  if (name.length > 200) throw new HttpError(400, "조직 이름이 너무 깁니다.");
  return name;
}

export class OrganizationsService {
  private db() {
    return getDb();
  }

  capabilities(actor: {
    sub: number;
    email: string;
  }): Promise<OrgCapabilities> {
    return this.buildCapabilities(actor);
  }

  private async buildCapabilities(actor: {
    sub: number;
    email: string;
  }): Promise<OrgCapabilities> {
    const isSuper = isSuperOrgAdminEmail(actor.email);
    const rows = await this.db()
      .select({
        organizationId: organizationMember.organizationId,
        role: organizationMember.role,
      })
      .from(organizationMember)
      .where(eq(organizationMember.userId, actor.sub));

    const adminOrganizationIds: number[] = [];
    const memberOrganizationIds: number[] = [];
    for (const r of rows) {
      memberOrganizationIds.push(r.organizationId);
      if (normalizeOrgMemberRole(r.role) === OrgMemberRole.Admin) {
        adminOrganizationIds.push(r.organizationId);
      }
    }
    return {
      isSuperOrgAdmin: isSuper,
      adminOrganizationIds,
      memberOrganizationIds,
    };
  }

  private async assertCanManageMembers(
    actor: { sub: number; email: string },
    organizationId: number,
  ): Promise<{ isSuper: boolean }> {
    const isSuper = isSuperOrgAdminEmail(actor.email);
    if (isSuper) return { isSuper: true };

    const rows = await this.db()
      .select({ role: organizationMember.role })
      .from(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, organizationId),
          eq(organizationMember.userId, actor.sub),
        ),
      )
      .limit(1);
    const role = rows[0] ? normalizeOrgMemberRole(rows[0].role) : null;
    if (role !== OrgMemberRole.Admin) {
      throw new HttpError(403, "이 조직의 멤버를 관리할 권한이 없습니다.");
    }
    return { isSuper: false };
  }

  async listForActor(actor: {
    sub: number;
    email: string;
  }): Promise<OrgListItem[]> {
    const caps = await this.buildCapabilities(actor);
    const db = this.db();

    const orgs = await db
      .select()
      .from(organization)
      .orderBy(asc(organization.parentId), asc(organization.name));

    let visible = orgs;
    if (!caps.isSuperOrgAdmin) {
      const allowed = new Set(caps.memberOrganizationIds);
      visible = orgs.filter((o) => allowed.has(o.id));
    }

    if (visible.length === 0) return [];

    const ids = visible.map((o) => o.id);
    const memberRows = await db
      .select({
        organizationId: organizationMember.organizationId,
      })
      .from(organizationMember)
      .where(inArray(organizationMember.organizationId, ids));

    const counts = new Map<number, number>();
    for (const m of memberRows) {
      counts.set(m.organizationId, (counts.get(m.organizationId) ?? 0) + 1);
    }

    return visible.map((o) => ({
      id: o.id,
      name: o.name,
      parentId: o.parentId ?? null,
      memberCount: counts.get(o.id) ?? 0,
    }));
  }

  async create(
    actor: { sub: number; email: string },
    input: { name: string; parentId?: number | null },
  ): Promise<OrgListItem> {
    if (!isSuperOrgAdminEmail(actor.email)) {
      throw new HttpError(403, "조직은 슈퍼 관리자만 만들 수 있습니다.");
    }
    const name = normalizeOrgName(input.name);
    const parentId =
      input.parentId == null || input.parentId === undefined
        ? null
        : Number(input.parentId);

    if (parentId != null) {
      if (!Number.isInteger(parentId) || parentId < 1) {
        throw new HttpError(400, "유효하지 않은 상위 조직입니다.");
      }
      const parents = await this.db()
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, parentId))
        .limit(1);
      if (parents.length === 0) {
        throw new HttpError(404, "상위 조직을 찾을 수 없습니다.");
      }
    }

    const inserted = await this.db()
      .insert(organization)
      .values({
        name,
        parentId,
        updatedAt: new Date(),
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new HttpError(500, "조직 생성에 실패했습니다.");
    return {
      id: row.id,
      name: row.name,
      parentId: row.parentId ?? null,
      memberCount: 0,
    };
  }

  async rename(
    actor: { sub: number; email: string },
    orgId: number,
    nameRaw: string,
  ): Promise<OrgListItem> {
    if (!isSuperOrgAdminEmail(actor.email)) {
      throw new HttpError(403, "조직 이름은 슈퍼 관리자만 변경할 수 있습니다.");
    }
    const name = normalizeOrgName(nameRaw);
    const updated = await this.db()
      .update(organization)
      .set({ name, updatedAt: new Date() })
      .where(eq(organization.id, orgId))
      .returning();
    const row = updated[0];
    if (!row) throw new HttpError(404, "조직을 찾을 수 없습니다.");

    const countRows = await this.db()
      .select({ id: organizationMember.id })
      .from(organizationMember)
      .where(eq(organizationMember.organizationId, orgId));
    return {
      id: row.id,
      name: row.name,
      parentId: row.parentId ?? null,
      memberCount: countRows.length,
    };
  }

  async remove(
    actor: { sub: number; email: string },
    orgId: number,
  ): Promise<void> {
    if (!isSuperOrgAdminEmail(actor.email)) {
      throw new HttpError(403, "조직은 슈퍼 관리자만 삭제할 수 있습니다.");
    }
    const deleted = await this.db()
      .delete(organization)
      .where(eq(organization.id, orgId))
      .returning({ id: organization.id });
    if (deleted.length === 0) {
      throw new HttpError(404, "조직을 찾을 수 없습니다.");
    }
  }

  async listMembers(
    actor: { sub: number; email: string },
    orgId: number,
  ): Promise<OrgMemberItem[]> {
    await this.assertCanViewOrg(actor, orgId);

    const rows = await this.db()
      .select({
        userId: organizationMember.userId,
        role: organizationMember.role,
        email: user.email,
        name: user.name,
        profileImageFilename: user.profileImageFilename,
      })
      .from(organizationMember)
      .innerJoin(user, eq(organizationMember.userId, user.id))
      .where(eq(organizationMember.organizationId, orgId))
      .orderBy(asc(user.name), asc(user.email));

    return rows.map((r) => ({
      userId: r.userId,
      email: r.email,
      name: r.name,
      imageUrl: avatarPublicUrl(r.profileImageFilename ?? null),
      role:
        normalizeOrgMemberRole(r.role) === OrgMemberRole.Admin
          ? "admin"
          : "member",
    }));
  }

  private async assertCanViewOrg(
    actor: { sub: number; email: string },
    orgId: number,
  ): Promise<void> {
    if (isSuperOrgAdminEmail(actor.email)) return;
    const caps = await this.buildCapabilities(actor);
    if (!caps.memberOrganizationIds.includes(orgId)) {
      throw new HttpError(403, "이 조직을 볼 권한이 없습니다.");
    }
  }

  async addMember(
    actor: { sub: number; email: string },
    orgId: number,
    input: { email: string; role?: string },
  ): Promise<OrgMemberItem> {
    const { isSuper } = await this.assertCanManageMembers(actor, orgId);

    const email = input.email.trim().toLowerCase();
    if (!email) throw new HttpError(400, "이메일을 입력해 주세요.");

    const role = normalizeOrgMemberRole(input.role ?? OrgMemberRole.Member);
    if (!isSuper && role === OrgMemberRole.Admin) {
      throw new HttpError(
        403,
        "조직 관리자 지정은 슈퍼 관리자만 할 수 있습니다.",
      );
    }

    const orgs = await this.db()
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    if (orgs.length === 0) throw new HttpError(404, "조직을 찾을 수 없습니다.");

    const users = await this.db()
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    const target = users[0];
    if (!target) {
      throw new HttpError(404, "해당 이메일 사용자를 찾을 수 없습니다.");
    }

    const existing = await this.db()
      .select({ id: organizationMember.id, role: organizationMember.role })
      .from(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, orgId),
          eq(organizationMember.userId, target.id),
        ),
      )
      .limit(1);

    if (existing[0]) {
      if (isSuper && normalizeOrgMemberRole(existing[0].role) !== role) {
        await this.db()
          .update(organizationMember)
          .set({ role })
          .where(eq(organizationMember.id, existing[0].id));
      } else if (normalizeOrgMemberRole(existing[0].role) === role) {
        throw new HttpError(409, "이미 이 조직에 속한 사용자입니다.");
      } else {
        throw new HttpError(409, "이미 이 조직에 속한 사용자입니다.");
      }
    } else {
      await this.db().insert(organizationMember).values({
        organizationId: orgId,
        userId: target.id,
        role,
      });
    }

    return {
      userId: target.id,
      email: target.email,
      name: target.name,
      imageUrl: avatarPublicUrl(target.profileImageFilename ?? null),
      role: role === OrgMemberRole.Admin ? "admin" : "member",
    };
  }

  async setMemberRole(
    actor: { sub: number; email: string },
    orgId: number,
    userId: number,
    roleRaw: string,
  ): Promise<OrgMemberItem> {
    if (!isSuperOrgAdminEmail(actor.email)) {
      throw new HttpError(
        403,
        "조직 내 역할 변경은 슈퍼 관리자만 할 수 있습니다.",
      );
    }
    const role = normalizeOrgMemberRole(roleRaw);
    const updated = await this.db()
      .update(organizationMember)
      .set({ role })
      .where(
        and(
          eq(organizationMember.organizationId, orgId),
          eq(organizationMember.userId, userId),
        ),
      )
      .returning();
    if (updated.length === 0) {
      throw new HttpError(404, "조직 멤버를 찾을 수 없습니다.");
    }
    const users = await this.db()
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const target = users[0];
    if (!target) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    return {
      userId: target.id,
      email: target.email,
      name: target.name,
      imageUrl: avatarPublicUrl(target.profileImageFilename ?? null),
      role: role === OrgMemberRole.Admin ? "admin" : "member",
    };
  }

  async removeMember(
    actor: { sub: number; email: string },
    orgId: number,
    userId: number,
  ): Promise<void> {
    const { isSuper } = await this.assertCanManageMembers(actor, orgId);

    if (!isSuper) {
      const rows = await this.db()
        .select({ role: organizationMember.role })
        .from(organizationMember)
        .where(
          and(
            eq(organizationMember.organizationId, orgId),
            eq(organizationMember.userId, userId),
          ),
        )
        .limit(1);
      if (
        rows[0] &&
        normalizeOrgMemberRole(rows[0].role) === OrgMemberRole.Admin
      ) {
        throw new HttpError(
          403,
          "조직 관리자는 슈퍼 관리자만 제거할 수 있습니다.",
        );
      }
    }

    const deleted = await this.db()
      .delete(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, orgId),
          eq(organizationMember.userId, userId),
        ),
      )
      .returning({ id: organizationMember.id });
    if (deleted.length === 0) {
      throw new HttpError(404, "조직 멤버를 찾을 수 없습니다.");
    }
  }
}
