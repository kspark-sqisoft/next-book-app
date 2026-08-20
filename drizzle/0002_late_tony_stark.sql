-- creta_* 테이블·제약은 과거 `db:push`로 이미 반영되어 있어(마이그레이션 이력 없음)
-- 자동 생성된 CREATE TABLE 문을 실행하면 기존 DB에서 실패한다. 이 마이그레이션은
-- 실제 신규 변경인 book_page.presentationVisible 컬럼 추가만 수행한다.
ALTER TABLE "book_page" ADD COLUMN "presentationVisible" boolean DEFAULT true NOT NULL;
