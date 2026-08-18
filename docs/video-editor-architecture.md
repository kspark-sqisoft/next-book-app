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

| 패키지                  | 역할                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `@twick/studio`         | 편집 UI 전체(라이브러리 패널·타임라인·캔버스·툴바)         |
| `@twick/timeline`       | 타임라인 데이터 모델·편집 API(트랙/요소 CRUD, 분할, undo)  |
| `@twick/live-player`    | 미리보기 실시간 재생                                       |
| `@twick/visualizer`     | 설계도를 실제 픽셀로 그리는 렌더러(미리보기·내보내기 공용) |
| `@twick/browser-render` | 프레임 그리기 + WebCodecs 인코딩 → MP4 조립                |

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
                              │    → WebCodecs(H.264) 인코딩 → MP4 조립
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

## 4. 로컬 파일 업로드 (My assets)

1. 편집기 라이브러리 패널의 업로드 버튼 → `POST /api/books/{id}/media-upload`
2. 서버가 파일을 `/uploads/book-videos/`에 저장하고 절대 URL 반환
3. 설계도에는 이 URL만 기록 — 미리보기·서버 렌더 모두 이 URL에서 영상을 읽는다

인증: Twick의 업로드 fetch는 Bearer 헤더를 못 붙이므로, 편집기가 access token을
짧은 쿠키(`twick_upload_at`, `/api/books` 경로 한정)로 실어주고 엔드포인트가 검증한다.

## 한 줄 요약

편집기는 **레시피를 고치는 도구**, 미리보기는 **레시피 즉석 시연**, 내보내기는
**주방(서버의 헤드리스 크롬)에서 레시피대로 완성품(MP4)을 만드는 것** —
원본 재료(업로드 영상)는 끝까지 손대지 않는다.
