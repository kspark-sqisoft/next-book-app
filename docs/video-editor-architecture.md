# 비디오 편집기 작동 원리

> 북 편집기의 "비디오 편집" 메뉴(Twick SDK 기반)가 어떻게 동작하는지 정리한 문서.
> 관련 코드: `src/components/books/BookVideoEditorDialog.tsx`,
> `src/server/video/twick-render.ts`, `src/server/video/render-jobs.ts`,
> `src/app/internal/render/page.tsx`, `src/app/api/books/[id]/media-upload/route.ts`

## 핵심 개념 — 비파괴 편집

**영상 파일을 직접 자르는 것이 아니라, 설계도(JSON)를 편집하고, 마지막에 그 설계도대로
영상을 새로 그려낸다.** 원본 업로드 파일은 끝까지 변경되지 않는다.

```
[편집 화면]  Twick Studio UI      ← 사용자가 보고 조작하는 부분
     ↓ 조작할 때마다
[설계도]     타임라인 JSON        ← "무엇을 언제 어디에" 기록한 데이터
     ↓ 이 설계도를 읽어서
[그리기]     미리보기(실시간) / 내보내기(서버 렌더)
```

## 구성 요소 (Twick SDK)

| 패키지                  | 역할                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `@twick/studio`         | 편집 UI 전체(라이브러리 패널·타임라인·캔버스·툴바)                 |
| `@twick/timeline`       | 타임라인 데이터 모델·편집 API(트랙/요소 CRUD, 분할, undo)          |
| `@twick/live-player`    | 미리보기 실시간 재생                                               |
| `@twick/visualizer`     | 설계도를 실제 픽셀로 그리는 렌더러(미리보기·내보내기 공용)         |
| `@twick/browser-render` | 프레임 그리기 + WebCodecs 인코딩 + mp4-wasm/ffmpeg.wasm 먹싱 → MP4 |

앱은 `BookVideoEditorDialog`가 전체 화면 포털(z-5000)로 `TwickStudio`를 띄우고,
저장·업로드·내보내기를 우리 서버와 연결한다. 편집기가 열려 있는 동안 뒤쪽
북 에디터의 단축키(Delete·Ctrl+S 등)는 전부 정지된다.

## 1. 편집 = 설계도 수정

타임라인의 모든 조작(클립 추가·자르기·이동·삭제)은 아래와 같은 JSON만 바꾼다.

```json
{
  "tracks": [
    {
      "elements": [{ "type": "video", "src": ".../영상A.mp4", "s": 0, "e": 5 }]
    },
    { "elements": [{ "type": "text", "text": "제목", "s": 1, "e": 4 }] }
  ]
}
```

- **트랙** = 층(레이어). twick 기본 규칙대로 **아래 트랙일수록 화면 앞**에 그려진다.
- **자르기(분할)** = 클립 하나를 `s/e` 구간 둘로 나누는 것. **삭제** = 배열에서 항목 제거.
- 원본 파일을 건드리지 않으므로 실행 취소는 설계도만 되돌리면 된다.
- 컴포지션(작업 좌표계)은 1280×720(16:9) 고정.

## 2. 미리보기 = 설계도를 실시간으로 그리기

재생 시 브라우저가 매 순간 "지금 시각에 보여야 할 요소"를 설계도에서 찾아
캔버스에 즉석 합성한다(`@twick/live-player` + visualizer). 파일을 만들지 않고
화면에만 그리므로 즉각적이다.

## 3. 내보내기(Export) = 서버 렌더

Export를 누르면 **서버가 헤드리스 Chromium을 띄워** 같은 렌더 코드를 실행한다.

```
브라우저 ──설계도 JSON──> 서버 액션 startBookVideoRender → 렌더 잡 생성(jobId)
                              │
                              ├─ 헤드리스 Chromium 실행 (Playwright)
                              ├─ 크롬이 자기 서버(127.0.0.1)의 /internal/render 페이지를 엶
                              ├─ 페이지가 설계도대로 프레임을 한 장씩 그림
                              │    → WebCodecs(H.264) 인코딩 → mp4-wasm 비디오 먹싱
                              │    → (오디오 있으면) ffmpeg.wasm으로 오디오 합성·최종 먹싱
                              └─ /uploads/book-videos/ 저장 + 첫 프레임 poster 생성
브라우저 ←──진행률 폴링(%)── getBookVideoRenderJob
        → 완료 시 미디어 라이브러리에 자동 등록 + 완료 안내
```

### 왜 서버가 "크롬"을 띄우나?

렌더 코드(visualizer)가 브라우저 기술(캔버스·WebCodecs)로 작성돼 있어, 서버에서도
브라우저를 하나 띄워 같은 코드로 그리게 한다. 사용자 PC 사양·탭 닫힘에 영향받지
않고, 결과물이 미리보기와 동일하다는 장점이 있다.

### 세부 제약과 해법

- **WebCodecs는 secure context 전용** → 렌더 페이지를 반드시 자기 서버
  (`localhost`/`127.0.0.1`)에서 연다. 업로드 영상 URL과 same-origin이 되는 효과도 있다.
- **H.264 인코딩(도커)** → Playwright 번들 크롬은 openh264가 없어 인코딩이 실패한다.
  그래서 도커 이미지는 Debian(bookworm) 기반 + 시스템 chromium(`CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`)을 쓴다.
- **해상도 선택(HD/FHD/QHD)** → 컴포지션 좌표계(1280×720)는 유지하고 그리기 배율
  (`quality`: 1×/1.5×/2×)만 키운다. 레이아웃 변형 없이 화질만 올라간다.
- **렌더 상한 15분** → 헤드리스가 특정 프레임에서 멈춰도 프로세스를 무한 점유하지 않는다.

### ffmpeg는 어디서 동작하나 (ffmpeg.wasm)

서버에 네이티브 ffmpeg 바이너리를 설치해 쓰는 것이 아니라, **브라우저 안에서 도는
WebAssembly 빌드(ffmpeg.wasm — `@ffmpeg/core` + `@twick/ffmpeg-web`)**가
`@twick/browser-render` 내부에서 실행된다. 미리보기에는 관여하지 않고
**내보내기 파이프라인에서만** 동작하며, 역할은 두 가지다.

1. **최종 먹싱·오디오 합성** — WebCodecs로 인코딩한 프레임을 mp4-wasm이 비디오
   전용 `video.mp4`로 조립한 뒤, 타임라인에 오디오가 있으면 추출한 `audio.wav`와
   함께 ffmpeg.wasm에 넣어 최종 MP4를 만든다. 실행되는 명령의 요지:

   ```
   ffmpeg -i video.mp4 -i audio.wav -map 0:v:0 -map 1:a:0
     -c:v libx264 -preset veryfast -crf 20     # 비디오 재인코딩
     -c:a aac -b:a 192k                        # 오디오 AAC
     -movflags +faststart -shortest output.mp4
   ```

   비디오를 copy하지 않고 libx264로 **재인코딩**하는 이유는 WebCodecs/mp4-wasm
   비트스트림을 그대로 복사하면 타이밍이 틀어져 첫 1초만 재생되는 문제가 있어서다
   (라이브러리 주석 명시).

2. **소재 영상 정규화(VideoNormalizer)** — 해상도·프레임레이트·픽셀 포맷이 제각각인
   소재를 렌더 전에 표준형으로 맞춘다:

   ```
   ffmpeg -i in.mp4 -vf scale=<w>:-2,fps=<fps>,format=yuv420p
     -c:v libx264 -profile:v main -c:a aac -ar 48000 -ac 2
     -movflags +faststart out.mp4
   ```

정리하면 **인코딩 파이프라인 = WebCodecs(H.264 프레임) → mp4-wasm(비디오 먹싱) →
ffmpeg.wasm(오디오 합성·최종 먹싱)**이고, 전부 브라우저(서버 렌더 시에는 헤드리스
Chromium) 안에서 실행되므로 서버에 별도 ffmpeg 설치가 필요 없다.

관련 사항 두 가지:

- `mp4-wasm.wasm`은 CDN 차단 환경에서도 동작하도록 `public/mp4-wasm.wasm`으로
  self-host한다(`npm run setup:wasm` — `scripts/copy-mp4-wasm.mjs`).
- 의존성 트리에는 **네이티브 ffmpeg**(`@twick/ffmpeg` → `@ffmpeg-installer/*`)도
  들어 있지만, 이는 우리가 쓰지 않는 Twick 자체 서버 렌더러(`@twick/renderer`)의
  전이 의존성일 뿐 이 앱의 렌더 경로에서는 실행되지 않는다.

## 4. 로컬 파일 업로드 (My assets)

1. 편집기 라이브러리 패널의 업로드 버튼 → `POST /api/books/{id}/media-upload`
2. 서버가 파일을 `/uploads/book-videos/`에 저장하고 절대 URL 반환
3. 설계도에는 이 URL만 기록 — 미리보기·서버 렌더 모두 이 URL에서 영상을 읽는다

인증: Twick의 업로드 fetch는 Bearer 헤더를 못 붙이므로, 편집기가 access token을
짧은 쿠키(`twick_upload_at`, `/api/books` 경로 한정)로 실어주고 엔드포인트가 검증한다.

## 5. 서버 확장 전략 — 여러 사용자가 동시에 내보낼 때

### 현재 구조의 한계 (2026-08 기준 실측 포함)

- 렌더는 **웹 앱과 같은 컨테이너**의 헤드리스 Chromium에서 실행된다. 렌더 1건이
  CPU 1~2코어를 점유하며(720p 10초 영상 ≈ 40~60초, 70초 영상 ≈ 3~5분 실측),
  동시 렌더가 몰리면 웹 응답까지 함께 느려진다.
- **동시 실행 제한이 없다** — 내보내기 요청마다 즉시 크롬 페이지가 하나씩 열린다
  (`render-jobs.ts`의 `startRenderJob`이 바로 `runJob` 실행). 10명이 동시에 누르면
  10건이 병렬로 돌며 서로를 느리게 만들고 OOM 위험이 생긴다.
- 잡 상태가 **프로세스 인메모리 Map**이다 → 서버 재시작 시 진행 중 잡 유실,
  앱 인스턴스를 2개 이상 띄우면 잡 조회가 불가(같은 인스턴스로만 폴링돼야 함).
- 결과 파일이 **로컬 볼륨**(`/app/uploads`)에 저장된다 → 다중 호스트 확장 시 공유 불가.

### 단계별 확장 로드맵

| 단계                       | 규모 감          | 핵심 변경                                                                                                                                                                                                             |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. 현재                    | 동시 사용자 소수 | 변경 없음(데모·학습용)                                                                                                                                                                                                |
| 1. 동시성 제한(권장 1순위) | 수십 명          | 렌더 세마포어(동시 N건, 예: 2) + 초과분은 `pending` 대기. 사용자별 동시 1건 제한. 코드 수십 줄로 가능, 단일 서버 유지                                                                                                 |
| 2. 렌더 워커 분리          | 수백 명          | 잡을 DB 테이블(`render_job`)로 이전 → 같은 이미지를 "워커 모드"(예: `RENDER_WORKER=1`) 별도 컨테이너로 기동해 DB 폴링·렌더·진행률 기록. 웹과 렌더 자원 격리, 워커 수 = 처리량. 같은 호스트면 uploads 볼륨 공유로 충분 |
| 3. 수평 확장               | 수천 명          | 워커 다중 호스트: 큐를 Redis(BullMQ 등)로, 파일 저장을 S3/MinIO로 이전, 결과는 CDN 서빙. 오토스케일은 **큐 길이 기반**(K8s HPA/KEDA). 워커 1대 사양 가이드: 2vCPU·2~4GB RAM에 동시 1~2건                              |
| 4. 최적화 옵션             | 비용·지연 최소화 | 브라우저 렌더를 네이티브 ffmpeg 합성 파이프라인으로 재작성(CPU 효율↑, 단 효과·전환 재구현 비용 큼), GPU 인코딩(NVENC) 노드, 우선순위 큐·사용자 쿼터                                                                   |

핵심 판단 기준: **1→2단계 전환 시점은 "렌더 때문에 웹이 느려진다"가 체감될 때**,
2→3단계는 "워커 1대(호스트 1대)로 대기열이 계속 쌓일 때"다.

### 단계 2로 갈 때 필요한 코드 변경 포인트

1. `render-jobs.ts`의 인메모리 `Map` → Drizzle `render_job` 테이블
   (id·bookId·status·progress·result·error·createdAt·startedAt). 클라이언트 폴링
   API(`getBookVideoRenderJob`)는 그대로 두고 저장소만 교체하면 된다.
2. 워커 진입점 추가: 같은 이미지에서 `RENDER_WORKER=1`이면 HTTP 리스너 대신
   "pending 잡 폴링 → `renderTwickProjectToMp4` 실행 → DB 갱신" 루프 실행.
   (렌더 페이지 `/internal/render`는 앱 서버가 서빙하므로 워커는 앱 URL로 접속)
3. 스톨 감지: `startedAt` 이후 진행률이 일정 시간 멈춘 잡을 `error` 처리 후 재시도
   1회. (현재는 15분 하드 타임아웃만 존재)
4. 다중 호스트로 갈 때만: `saveBookMainAndPoster`의 로컬 쓰기를 S3 계열 업로드로
   교체하고 `/uploads` 서빙을 스토리지/CDN으로 위임.

### 어느 단계든 함께 두면 좋은 안전장치

- 사용자당 동시 렌더 1건 + 대기열 위치 표시, 렌더 길이 상한(예: 컴포지션 10분)
- 완료 잡 TTL 정리(현재 30분 인메모리 GC → DB 이전 시 동일 정책 유지)
- 워커 헬스체크(큐 소비 정체 알림)와 렌더 실패율 모니터링

## 한 줄 요약

편집기는 **레시피를 고치는 도구**, 미리보기는 **레시피 즉석 시연**, 내보내기는
**주방(서버의 헤드리스 크롬)에서 레시피대로 완성품(MP4)을 만드는 것** —
원본 재료(업로드 영상)는 끝까지 손대지 않는다.
