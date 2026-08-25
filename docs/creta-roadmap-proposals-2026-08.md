# 크레타(디지털 사이니지 CMS) 기능 확장 제안 — 2026-08

주요 상용·오픈소스 사이니지 CMS(Xibo, ScreenCloud, Yodeck, OptiSigns, Samsung VXT/MagicINFO, LG SuperSign)의
기능을 조사해, **크레타에 아직 없는 표준 기능과 차별화 요소**를 우선순위와 함께 정리한 문서입니다.

## 크레타 현재 기능 요약 (2026-08 기준)

| 영역            | 보유 기능                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 콘텐츠(북) 편집 | 캔버스 에디터, 위젯(텍스트·이미지·비디오·날씨·시계·뉴스·차트·QR·티커·유튜브 등), 텍스트 애니메이션 10종, 슬라이드 전환, 페이지 숨김, 템플릿, PDF 가져오기, 드로잉, AI 레이아웃 어시스턴트 |
| 미디어          | 서버 보관 미디어 라이브러리, 파일별 공유(특정 회원/전체), 이미지·비디오 편집기, 동영상 이어붙이기, 서버 렌더                                                                              |
| 편성            | 플레이리스트(북 묶음·순환), 스케줄(시간대 슬롯, 반복: 매일/평일/주말/기간, 기본 재생, 월 달력, 자동 적용)                                                                                 |
| 디바이스        | 소스 지정(북/플레이리스트/스케줄), 온라인 상태, 전원 예약(+제외일), 해상도·방향, 리소스 게이지, 로그(시뮬레이션)                                                                          |
| 협업·권한       | 북·플레이리스트·스케줄 회원 공유 + "모든 사용자" 공유, 조직 관리, 커뮤니티(댓글·좋아요), 계정 현황                                                                                        |

---

## 1순위 — 사이니지 CMS의 "표준 기능"인데 크레타에 없는 것

### 1. 긴급 알림 오버라이드 (Emergency Alerts) — ✅ 구현됨(2026-08-25)

- **무엇**: 모든(또는 선택한) 디바이스의 현재 재생을 즉시 덮어쓰는 긴급 공지. 해제 시 원래 편성으로 복원.
  업계 표준 프로토콜로 CAP(Common Alerting Protocol)이 있고 Yodeck·ScreenCloud 등 대부분이 제공.
- **크레타 적용**: 디바이스 소스 지정 구조가 이미 있으므로
  "긴급 메시지 작성 → 대상 디바이스 선택(또는 전체) → 강제 전환 → 해제 시 복원" 흐름으로 구현.
- **난도/효과**: 낮음 / 큼.

### 2. Proof-of-Play 재생 리포트 — ✅ 구현됨(2026-08-25)

- **무엇**: 어떤 콘텐츠가 언제·어느 디바이스에서 몇 번 재생됐는지 로그와 기간별 리포트.
  광고 검증·컴플라이언스·프랜차이즈 감사용 필수 기능.
- **크레타 적용**: 디바이스 시뮬레이션에 로그 카드가 이미 있으므로 재생 이력 테이블
  (`device_play_log`: deviceId, contentKind, contentId, startedAt, durationSec)과 기간별 집계 리포트 화면 추가.
- **난도/효과**: 중간 / 큼.

### 3. 디바이스 태그/그룹 배포 — ✅ 구현됨(2026-08-25)

- **무엇**: 디바이스에 태그(예: "1층", "매장A", "세로형")를 붙이고 태그 단위로 스케줄·콘텐츠를 일괄 배포.
  LG SuperSign "tags match", 상용 CMS의 그룹 타게팅에 해당. 한 디바이스가 여러 태그에 동시에 속할 수 있어야 함.
- **크레타 적용**: `device_tag` 테이블 + 디바이스 편집에 태그 입력 + 스케줄/콘텐츠 배포 다이얼로그에
  "태그로 선택" 탭 추가.
- **난도/효과**: 중간 / 큼(대수가 늘수록 핵심).

### 4. 운영 대시보드 + 오프라인 알림 — ✅ 구현됨(2026-08-25)

- **무엇**: 전체 요약 한 화면 — 온라인율, 오프라인 디바이스 목록, 지금 재생 중인 콘텐츠 현황, 최근 이벤트.
  디바이스가 끊기면 알림(이메일·웹 알림).
- **크레타 적용**: 이미 있는 온라인 상태·리소스 게이지·현재 콘텐츠 데이터를 `/dashboard` 한 화면으로 집계.
  알림은 우선 앱 내 알림(토스트/벨)부터.
- **난도/효과**: 낮음 / 중간.

### 5. 스케줄 공휴일·예외일 처리

- **무엇**: 공휴일엔 다른 편성을 틀거나 쉬는 "달력 예외(calendar exceptions)" — Xibo가 강조하는 기능.
  특정 날짜 우선 편성(이벤트 데이)도 포함.
- **크레타 적용**: 디바이스 전원 예약에 이미 있는 제외일(`powerExcludeDates`) 패턴을 스케줄 슬롯에 재사용.
  슬롯에 `excludeDates` + "이 날짜만 우선" 슬롯 타입 추가, 월 달력에 예외일 표시.
- **난도/효과**: 낮음 / 중간.

---

## 2순위 — 차별화 요소

### 6. 데이터 연동 위젯 (DataSets / 메뉴보드)

- **무엇**: 구글 시트·CSV·외부 API를 데이터 소스로 등록하면 북 위젯(표·메뉴보드·가격표)이 자동 갱신.
  Xibo DataSets, OptiSigns 앱 연동에 해당. 식당 메뉴보드·회의실 예약판이 대표 사례.
- **크레타 적용**: 날씨·뉴스 위젯과 같은 서버 프록시 패턴으로 "데이터셋" 도메인 신설 → 표/메뉴보드 위젯 추가.
- **난도/효과**: 중간~높음 / 큼(실사용 사례 확장).

### 7. 승인 워크플로 + 감사 로그 — ✅ 구현됨(2026-08-25)

- **무엇**: 작성 → 검토 요청 → 승인 → 게시 단계와 "누가 언제 무엇을 바꿨는지" 이력.
  ScreenCloud가 기업용으로 내세우는 거버넌스 영역.
- **크레타 적용**: 북에 `status(draft|review|published)` + 조직 관리자 승인 액션 + 변경 이력 테이블.
  역할도 현재 user/admin 2단계에서 편집자/게시자/뷰어로 세분화.
- **난도/효과**: 중간 / 중간(조직 기능의 자연스러운 다음 단계).

### 8. 원격 디바이스 제어 확장 — ✅ 구현됨(2026-08-25)

- **무엇**: 현재 화면 스크린샷 보기, 재부팅, 볼륨·밝기 조절, 플레이어 버전 업데이트 —
  Samsung VXT·MagicINFO가 강조하는 원격 관리.
- **크레타 적용**: 디바이스 시뮬레이션에 명령 큐(스크린샷 = 현재 소스의 커버 렌더, 재부팅 = 상태 리셋 연출) 추가.
- **난도/효과**: 낮음(시뮬레이션이라) / 중간.

### 9. 터치/QR 인터랙티브 (키오스크)

- **무엇**: 재생 화면에서 터치(또는 QR 스캔)로 상세 콘텐츠 이동, 웨이파인딩. OptiSigns의 터치·QR 사례.
- **크레타 적용**: QR 위젯이 이미 있으므로 "QR 스캔 수 추적(단축 URL 경유)"부터 시작 →
  프레젠테이션에 터치 핫스팟 위젯(누르면 특정 슬라이드/북으로 이동) 추가.
- **난도/효과**: 중간 / 중간.

### 10. 비디오월 동기화

- **무엇**: 여러 디바이스가 한 콘텐츠를 나눠 표시하거나 같은 시점을 동시 재생(LG videowall sync).
- **크레타 적용**: 프레젠테이션 페이지에 "타일 모드(행×열 중 내 위치)" 파라미터 + 소켓 기반 재생 시각 동기화.
  채팅에서 쓰는 소켓 인프라 재사용 가능.
- **난도/효과**: 높음 / 학습 가치 큼.

---

## 권장 진행 순서

```
① 긴급 오버라이드 → ② Proof-of-Play → ③ 디바이스 태그 배포 → ④ 대시보드/알림 → ⑤ 스케줄 예외일
그다음: ⑥ 데이터셋 메뉴보드 → ⑦ 승인 워크플로 → ⑧ 원격 제어 → ⑨ 인터랙티브 → ⑩ 비디오월
```

①~⑤는 기존 스키마·화면 구조에 바로 붙는 것 위주라 각각 하루 안팎의 작업으로 예상됩니다.

## 참고 자료

- [Kitcast — Digital Signage Software Top 10 (2026)](https://kitcast.tv/digital-signage-software)
- [CrownTV — ScreenCloud vs OptiSigns vs Yodeck](https://www.crowntv-us.com/blog/screencloud-vs-optisigns-vs-yodeck/)
- [Yodeck — Digital Signage Features Buyer's Checklist](https://www.yodeck.com/use-cases/digital-signage-features/)
- [Yodeck — Emergency Alerts](https://www.yodeck.com/use-cases/digital-signage-for-emergency-situations/)
- [Xibo — Features](https://xibosignage.com/features) · [Xibo — DataSets 회의실 예약 사례](https://xibosignage.com/blog/using-datasets-to-display-meeting-room-bookings)
- [LG SuperSign CMS](https://www.lg.com/global/business/commercial-display/software-services/lg-supersign-cms/)
- [Samsung MagicINFO](https://www.samsung.com/us/business/solutions/digital-signage-solutions/magicinfo/) · [Samsung VXT 소개](https://www.sixteen-nine.net/2024/02/16/samsung-eyes-long-tail-of-smb-market-for-its-now-released-vxt-digital-signage-platform/)
- [PlayIPP — CMS 기능 가이드](https://playipp.com/resources/digital-signage-cms/)
