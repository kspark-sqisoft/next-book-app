// node:fs — 디스크에 저장된 고양이 이미지 파일 삭제용
import { unlink } from "node:fs/promises";
// 업로드 디렉터리와 DB의 파일명을 합칠 때 사용
import { join } from "node:path";

// Drizzle: 정렬·WHERE 조건 빌더
import { asc, eq } from "drizzle-orm";

// 서버 권한: 고양이 리소스 수정 가능 여부(소유자·관리자)
import {
  type AuthActor,
  canMutateCatResource,
} from "@/server/auth/auth-policy";
// 앱 전역 DB 인스턴스
import { getDb } from "@/server/db";
// 학습용 고양이 테이블 정의
import { studyCats } from "@/server/db/schema";
// 정적 파일 루트·고양이 이미지 하위 경로
import { CAT_IMAGES_SUBDIR, UPLOAD_ROOT } from "@/server/env";
// HTTP 상태·메시지가 있는 앱 표준 에러
import { HttpError } from "@/server/http/http-error";

// API·클라이언트에 내려줄 공개 필드(파일명 대신 URL)
export type CatPublic = {
  id: number; // PK
  name: string; // 표시 이름
  age: number; // 0~40 등 검증된 나이
  breed: string; // 품종 문자열(빈 값은 서버에서 mixed)
  imageUrl: string | null; // 브라우저용 공개 URL 또는 없음
  ownerId: number | null; // 등록자; 옛 데이터는 null
  createdAt: Date; // 생성 시각
  updatedAt: Date; // 마지막 수정 시각
};

// DB 접근·권한·이미지 파일 정리를 묶은 Cats 도메인 서비스
export class CatsService {
  // 매 호출 시점의 Drizzle 클라이언트
  private db() {
    return getDb();
  }

  // DB의 imageFilename을 웹에서 쓰는 `/uploads/...` 경로로 변환
  private imagePublicUrl(filename: string | null | undefined): string | null {
    const f = filename?.trim(); // 공백만 있으면 없는 것과 동일
    if (!f) return null; // 파일 없으면 URL 없음
    return `/uploads/${CAT_IMAGES_SUBDIR}/${f}`; // 정적 서빙 경로 규약
  }

  // DB 행 → 클라이언트용 DTO
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
      imageUrl: this.imagePublicUrl(row.imageFilename), // 파일명만 URL로 승격
      ownerId: row.ownerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // 디스크에서 이전 사진 파일 제거(실패해도 요청은 진행 — catch로 삼킴)
  private async unlinkCatImage(
    filename: string | null | undefined,
  ): Promise<void> {
    const f = filename?.trim();
    if (!f) return; // 삭제할 파일 없음
    const p = join(UPLOAD_ROOT, CAT_IMAGES_SUBDIR, f); // 절대 경로
    await unlink(p).catch(() => undefined); // ENOENT 등은 무시
  }

  // 전체 목록: id 오름차순
  async findAll(): Promise<CatPublic[]> {
    const db = this.db();
    const rows = await db.query.studyCats.findMany({
      orderBy: asc(studyCats.id),
    });
    return rows.map((r) => this.toPublic(r)); // 각 행을 공개 형태로
  }

  // id로 한 행 조회; 없으면 404
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

  // 단건 공개 조회
  async findOne(id: number): Promise<CatPublic> {
    const cat = await this.findEntity(id);
    return this.toPublic(cat);
  }

  // 신규 행 삽입; ownerId는 JWT의 사용자 id
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
        imageFilename: null, // 사진은 별도 업로드 액션에서 채움
      })
      .returning(); // 삽입 직후 행 반환(Postgres)
    return this.toPublic(saved);
  }

  // 부분 갱신; 소유자·관리자만
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
      ...cat, // 기존 값에서 시작
      ...(dto.name !== undefined ? { name: dto.name } : {}), // 전달된 필드만 덮어씀
      ...(dto.age !== undefined ? { age: dto.age } : {}),
      ...(dto.breed !== undefined ? { breed: dto.breed } : {}),
      updatedAt: new Date(), // 서버가 갱신 시각 기록
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
    const fresh = await this.findEntity(id); // DB에 반영된 최신 행 재조회
    return this.toPublic(fresh);
  }

  // 새 파일명으로 이미지 교체; 이전 파일은 디스크에서 삭제 시도
  async uploadImage(
    id: number,
    storedFilename: string,
    actor: AuthActor,
  ): Promise<CatPublic> {
    const cat = await this.findEntity(id);
    if (!canMutateCatResource(actor, cat.ownerId)) {
      throw new HttpError(403, "Forbidden");
    }
    const prev = cat.imageFilename; // 교체 전 파일명 보관
    const db = this.db();
    await db
      .update(studyCats)
      .set({
        imageFilename: storedFilename,
        updatedAt: new Date(),
      })
      .where(eq(studyCats.id, id));
    if (prev && prev !== storedFilename) {
      await this.unlinkCatImage(prev); // 구 파일 정리
    }
    const fresh = await this.findEntity(id);
    return this.toPublic(fresh);
  }

  // 행 삭제 전 이미지 파일 제거 후 DB delete
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
