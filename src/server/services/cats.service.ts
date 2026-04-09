import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { studyCats } from "@/server/db/schema";
import { CAT_IMAGES_SUBDIR, UPLOAD_ROOT } from "@/server/env";
import { type AuthActor, canMutateCatResource } from "@/server/auth/auth-policy";
import { HttpError } from "@/server/http/http-error";

export type CatPublic = {
  id: number;
  name: string;
  age: number;
  breed: string;
  imageUrl: string | null;
  ownerId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export class CatsService {
  private db() {
    return getDb();
  }

  private imagePublicUrl(filename: string | null | undefined): string | null {
    const f = filename?.trim();
    if (!f) return null;
    return `/uploads/${CAT_IMAGES_SUBDIR}/${f}`;
  }

  toPublic(row: {
    id: number;
    name: string;
    age: number;
    breed: string;
    imageFilename: string | null;
    ownerId: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): CatPublic {
    return {
      id: row.id,
      name: row.name,
      age: row.age,
      breed: row.breed,
      imageUrl: this.imagePublicUrl(row.imageFilename),
      ownerId: row.ownerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async unlinkCatImage(
    filename: string | null | undefined,
  ): Promise<void> {
    const f = filename?.trim();
    if (!f) return;
    const p = join(UPLOAD_ROOT, CAT_IMAGES_SUBDIR, f);
    await unlink(p).catch(() => undefined);
  }

  async findAll(): Promise<CatPublic[]> {
    const db = this.db();
    const rows = await db.query.studyCats.findMany({
      orderBy: asc(studyCats.id),
    });
    return rows.map((r) => this.toPublic(r));
  }

  private async findEntity(id: number) {
    const db = this.db();
    const cat = await db.query.studyCats.findFirst({
      where: eq(studyCats.id, id),
    });
    if (!cat) {
      throw new HttpError(404, `고양이 #${id} 를 찾을 수 없습니다.`);
    }
    return cat;
  }

  async findOne(id: number): Promise<CatPublic> {
    const cat = await this.findEntity(id);
    return this.toPublic(cat);
  }

  async create(
    dto: { name: string; age: number; breed: string },
    ownerId: number,
  ): Promise<CatPublic> {
    const db = this.db();
    const [saved] = await db
      .insert(studyCats)
      .values({
        name: dto.name,
        age: dto.age,
        breed: dto.breed,
        ownerId,
        imageFilename: null,
      })
      .returning();
    return this.toPublic(saved);
  }

  async update(
    id: number,
    dto: { name?: string; age?: number; breed?: string },
    actor: AuthActor,
  ): Promise<CatPublic> {
    const cat = await this.findEntity(id);
    if (!canMutateCatResource(actor, cat.ownerId)) {
      throw new HttpError(403, "Forbidden");
    }
    const db = this.db();
    const next = {
      ...cat,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.age !== undefined ? { age: dto.age } : {}),
      ...(dto.breed !== undefined ? { breed: dto.breed } : {}),
      updatedAt: new Date(),
    };
    await db
      .update(studyCats)
      .set({
        name: next.name,
        age: next.age,
        breed: next.breed,
        updatedAt: next.updatedAt,
      })
      .where(eq(studyCats.id, id));
    const fresh = await this.findEntity(id);
    return this.toPublic(fresh);
  }

  async uploadImage(
    id: number,
    storedFilename: string,
    actor: AuthActor,
  ): Promise<CatPublic> {
    const cat = await this.findEntity(id);
    if (!canMutateCatResource(actor, cat.ownerId)) {
      throw new HttpError(403, "Forbidden");
    }
    const prev = cat.imageFilename;
    const db = this.db();
    await db
      .update(studyCats)
      .set({
        imageFilename: storedFilename,
        updatedAt: new Date(),
      })
      .where(eq(studyCats.id, id));
    if (prev && prev !== storedFilename) {
      await this.unlinkCatImage(prev);
    }
    const fresh = await this.findEntity(id);
    return this.toPublic(fresh);
  }

  async remove(id: number, actor: AuthActor): Promise<void> {
    const cat = await this.findEntity(id);
    if (!canMutateCatResource(actor, cat.ownerId)) {
      throw new HttpError(403, "Forbidden");
    }
    await this.unlinkCatImage(cat.imageFilename);
    const db = this.db();
    await db.delete(studyCats).where(eq(studyCats.id, id));
  }
}
