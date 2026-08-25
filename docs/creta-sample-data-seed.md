# 크레타 샘플 데이터 — 다른 PC에 적용하기

빈 DB로 앱을 띄우면 크레타 메뉴가 전부 비어 있어 화면을 확인하기 어렵다.
`scripts/seed-creta-sample.mjs` 가 스튜디오·플레이리스트·스케줄·디바이스·비디오월·
광고·재생 리포트를 한 번에 채운다.

이 문서는 **집 PC에서 만든 데이터를 회사 PC에서 그대로 재현하는 절차**를 정리한 것이다.

---

## 0. 준비물

| 항목                                 | 비고                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| `creta-sample-bundle.zip` (약 126MB) | 준비된 미디어가 들어 있는 꾸러미. USB·클라우드로 옮긴다   |
| 이 저장소 최신본                     | `git pull`                                                |
| Docker Desktop                       | 실행 중이어야 한다                                        |
| `noa99kee@gmail.com` 계정            | 대상 DB에 가입돼 있어야 한다 ([3단계](#3-계정-확인) 참고) |

미디어(`uploads/`)는 `.gitignore` 대상이라 git으로는 절대 넘어가지 않는다.
번들이 필요한 이유가 이것이다. 코드는 git에 있으므로 번들 없이도 `npm run` 으로
시드를 돌릴 수 있지만, 그러려면 원본 영상 파일이 그 PC에 있어야 한다.

---

## 1. 저장소 최신화

```bash
cd ~/Workspace/next-book-app     # 실제 경로에 맞게
git pull
npm ci                            # node_modules 가 없거나 오래됐으면
```

`npm ci` 는 필수다. 시드 스크립트가 저장소의 `postgres` 패키지를 쓴다.

## 2. 번들 풀고 적용

> **저장소 루트에서 실행해야 한다.** 적용 스크립트는 현재 폴더를 기준으로 파일을 놓는다.

### macOS · Linux

```bash
unzip ~/Downloads/creta-sample-bundle.zip -d ~/Downloads
cd ~/Workspace/next-book-app
~/Downloads/creta-sample-bundle/apply.sh
```

### Windows (PowerShell)

`apply.sh` 는 bash 스크립트라 윈도우에서 돌지 않는다. 같은 일을 하는
`apply.ps1` 을 쓴다.

```powershell
# 압축 풀기 — 탐색기에서 우클릭 "압축 풀기" 해도 된다
Expand-Archive -Path "$HOME\Downloads\creta-sample-bundle.zip" -DestinationPath "$HOME\Downloads"

cd C:\Workspace\next-book-app          # 실제 경로에 맞게
powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\creta-sample-bundle\apply.ps1"
```

`-ExecutionPolicy Bypass` 는 기본 실행 정책이 스크립트를 막기 때문에 필요하다.
저장소 경로가 다르면 `cd` 만 바꾸면 된다.

### 적용 스크립트가 하는 일

1. 번들의 코드 파일을 저장소에 복사 (git pull 로 이미 같은 내용이면 덮어써도 무해)
2. 준비된 미디어를 `./uploads` 로 복사
3. `docker compose up -d --build` — 이미지 빌드 때문에 처음엔 몇 분 걸린다
4. 앱이 응답할 때까지 기다렸다가 시드 삽입 → 미디어를 컨테이너 볼륨으로 복사

끝나면 <http://localhost:3000/dashboard> 에서 확인한다.

## 3. 계정 확인

시드 데이터의 소유자(작성자)로 붙일 계정이 DB에 있어야 한다. 기본값은
`noa99kee@gmail.com` 이다.

계정이 없으면 적용 스크립트는 3단계까지 진행해 앱을 띄운 뒤 4단계에서 멈춘다.

```
실패: 계정을 찾을 수 없습니다: noa99kee@gmail.com — 앱에서 먼저 회원가입을 해주세요.
```

이때는 <http://localhost:3000/signup> 에서 가입한 뒤 적용 스크립트를 **다시 실행**하면 된다.
다시 실행해도 중복 생성되지 않는다.

다른 계정을 소유자로 쓰려면:

```bash
# macOS · Linux
OWNER_EMAIL=someone@example.com ~/Downloads/creta-sample-bundle/apply.sh
```

```powershell
# Windows
$env:OWNER_EMAIL = "someone@example.com"
powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\creta-sample-bundle\apply.ps1"
```

---

## 번들 없이 직접 실행하기

원본 미디어(`~/Downloads` 의 mp4·jpg)가 그 PC에 있다면 번들 없이도 된다.

```bash
# macOS · Linux — 도커 스택이 떠 있는 상태에서
DB_HOST=127.0.0.1 node scripts/seed-creta-sample.mjs \
  --media ~/Downloads \
  --upload-root ./uploads \
  --owner-email noa99kee@gmail.com

docker cp uploads/. next-book-app-app-1:/app/uploads/
docker compose exec -u root app chown -R nextjs:nodejs /app/uploads
```

```powershell
# Windows
$env:DB_HOST = "127.0.0.1"
node scripts\seed-creta-sample.mjs --media "$HOME\Downloads" --upload-root .\uploads --owner-email noa99kee@gmail.com

docker cp .\uploads\. next-book-app-app-1:/app/uploads/
docker compose exec -u root app chown -R nextjs:nodejs /app/uploads
```

로컬 개발(`npm run dev`)만 쓴다면 `docker cp` 두 줄은 필요 없다.
`./uploads` 가 곧 `UPLOAD_ROOT` 이기 때문이다.

### 옵션

| 옵션                     | 기본값                          | 설명                                                      |
| ------------------------ | ------------------------------- | --------------------------------------------------------- |
| `--media <폴더>`         | `~/Downloads`                   | 원본 이미지·영상 위치                                     |
| `--upload-root <폴더>`   | `$UPLOAD_ROOT` 또는 `./uploads` | 준비된 미디어를 놓을 곳                                   |
| `--owner-email <이메일>` | 가장 먼저 만든 계정             | 시드 데이터의 작성자 (`SEED_OWNER_EMAIL` 환경변수도 가능) |

`--upload-root` 에 준비된 파일이 이미 있으면 원본은 필요 없다.
번들이 이 성질을 이용한다.

---

## 들어가는 데이터

시나리오는 "크레타 리조트" 사이니지 운영이다.

| 메뉴         | 내용                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| 스튜디오     | 북 7개 / 슬라이드 15장 — 전체화면 미디어 + 자막 띠 + 안내 텍스트             |
| 플레이리스트 | 6개 (로비 상시 · 라운지 앰비언트 · 모닝 오프닝 · 홀리데이 · 피트니스 · 카페) |
| 스케줄       | 5개 · 시간대 12개 — 평일·주말·매일·기간지정 반복 규칙 전부 사용              |
| 디바이스     | 10대 — 4개 플랫폼, 가로/세로, 온라인 8·오프라인 1·비정상 1, 태그·전원예약    |
| 비디오월     | 5개 — 타일(2×2)·미러·멀티 3개 모드, 멤버 12대                                |
| 광고         | 광고주 5 · 캠페인 7 · 소재 10 · 구좌 3 · 노출 로그 3,780건 · 변경 이력 7건   |
| 재생 리포트  | 재생 이력 약 5,900건(10일치)                                                 |
| 알림         | 이력 4건 (안내·주의·긴급)                                                    |

미디어 7종은 각각 아래 용도로 붙는다.

| 화면                     | 쓰임                      |
| ------------------------ | ------------------------- |
| 추상 골드 모션           | 브랜드 인트로             |
| 아이슬란드 검은모래 해변 | 라운지 앰비언트           |
| 운해 위 일출             | 모닝 오프닝               |
| 에메랄드 해안 항공뷰     | 카페·스노클링 안내        |
| 설산 파노라마            | 비디오월·피트니스         |
| 여름 하늘·야자수         | 카페 낮 시간대            |
| 홀리데이 배경(이미지)    | 연말 프로모션·하우스 광고 |

---

## 알아 둘 점

- **재실행은 안전하다.** 시드가 만든 행만 이름으로 찾아 지우고 다시 넣는다.
  직접 만든 북·디바이스·플레이리스트는 건드리지 않는다.
- **재생 리포트의 최근 48시간**은 앱이 리포트를 열 때 스스로 채운다
  (`creta-play-log.service.ts` 의 backfill). 시드는 그 이전 10일치를 넣는다.
  적용 직후 대시보드를 한 번 열면 최신 구간이 붙는다.
- **스케줄 카드가 "재생 콘텐츠 없음"으로 보일 때**가 있다. 그 시각에 해당하는
  시간대가 없으면 정상이다. 예를 들어 카페 편성은 22:00에 끝난다.
- **4K 영상 한 편(265MB)은 1080p로 변환해서 넣었다.** 앱 업로드 상한이 150MB라
  원본 그대로는 들어가지 않는다 (`save-book-media.ts`).

## 문제가 생기면

| 증상                                                    | 원인·조치                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `node_modules가 없습니다`                               | `npm ci` 실행                                                                                   |
| `계정을 찾을 수 없습니다`                               | `/signup` 에서 가입 후 재실행 ([3단계](#3-계정-확인))                                           |
| `앱 컨테이너가 종료됐습니다`                            | `docker compose logs app` 확인. 마이그레이션 실패면 `drizzle/` 가 최신인지 본다                 |
| 목록은 나오는데 이미지가 깨짐                           | 미디어가 컨테이너 볼륨에 없다. `docker cp uploads/. next-book-app-app-1:/app/uploads/` 후 chown |
| 데이터를 싹 지우고 싶다                                 | `docker compose down -v` 로 볼륨까지 지운 뒤 처음부터                                           |
| (Windows) `이 시스템에서 스크립트를 실행할 수 없으므로` | `powershell -ExecutionPolicy Bypass -File ...` 형태로 실행                                      |
| (Windows) `apply.sh` 가 안 열림                         | 윈도우에서는 `apply.ps1` 을 쓴다                                                                |

## 관련 파일

| 경로                                 | 역할                                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| `scripts/seed-creta-sample.mjs`      | 미디어 준비 + DB 삽입                                            |
| `scripts/seed-creta-sample.data.mjs` | 샘플 데이터 정의(내용을 바꾸려면 여기)                           |
| `drizzle/0002_1_creta_baseline.sql`  | `creta_*` 테이블 생성 마이그레이션 — 없으면 도커 기동이 실패한다 |

번들 안에는 `apply.sh`(macOS·Linux)와 `apply.ps1`(Windows)이 함께 들어 있다.
둘은 같은 일을 한다.
