// 크레타 샘플 데이터 정의 — 미디어 매니페스트 + 각 메뉴(스튜디오·플레이리스트·스케줄·
// 디바이스·비디오월·광고)의 시드 내용. 시나리오는 "크레타 리조트" 사이니지 운영이며,
// 실제 미디어 화면(아이슬란드 해변·운해 일출·설산·에메랄드 해안·여름 하늘·추상 골드
// 모션·홀리데이 배경)에 맞춰 이름과 편성을 붙였다.
// 삽입 로직은 `seed-creta-sample.mjs`에 있다.

/** 슬라이드 논리 크기 — 시드 북 전부 동일 */
export const SLIDE_W = 960;
export const SLIDE_H = 540;

/**
 * `~/Downloads` 원본 → 업로드 폴더로 옮길 미디어.
 * - `transcodeTo1080p`: 앱 업로드 상한(150MB)을 넘는 4K 원본만 변환
 * - `posterAt`: 포스터로 뽑을 대표 프레임 시각(초)
 */
export const MEDIA = [
  {
    key: "goldmotion",
    kind: "video",
    source: "16446490_1920_1080_30fps.mp4",
    file: "sample-gold-motion.mp4",
    posterAt: 7,
    label: "골드 시그니처 모션",
  },
  {
    key: "iceland",
    kind: "video",
    source: "12608904_3840_2160_25fps.mp4",
    file: "sample-iceland-blacksand.mp4",
    posterAt: 19,
    transcodeTo1080p: true,
    label: "아이슬란드 블랙샌드 비치",
  },
  {
    key: "cloudsea",
    kind: "video",
    source: "13427339_3840_2160_25fps.mp4",
    file: "sample-cloudsea-sunrise.mp4",
    posterAt: 7,
    label: "운해 위 일출",
  },
  {
    key: "emerald",
    kind: "video",
    source: "15039224_3840_2160_30fps.mp4",
    file: "sample-emerald-coast.mp4",
    posterAt: 5,
    label: "에메랄드 코스트",
  },
  {
    key: "alpine",
    kind: "video",
    source: "19150364-uhd_3840_2160_60fps.mp4",
    file: "sample-alpine-snow.mp4",
    posterAt: 6,
    label: "알파인 설산 파노라마",
  },
  {
    key: "summersky",
    kind: "video",
    source: "13780359_1920_1080_30fps.mp4",
    file: "sample-summer-sky.mp4",
    posterAt: 2,
    label: "여름 하늘 라운지",
  },
  {
    key: "holiday",
    kind: "image",
    source: "holiday-background_5YIJOVUMD4.jpg",
    file: "sample-holiday-bg.jpg",
    label: "홀리데이 시즌 배경",
  },
];

// ── 슬라이드 요소 빌더 ──────────────────────────────────────────────

let elementSeq = 0;
const nextId = () => `seed-el-${++elementSeq}`;

/** 화면을 꽉 채우는 영상 */
function fullVideo(media) {
  return {
    id: nextId(),
    type: "video",
    x: 0,
    y: 0,
    width: SLIDE_W,
    height: SLIDE_H,
    src: media.src,
    posterSrc: media.poster,
    objectFit: "cover",
    videoLoop: true,
  };
}

/** 화면을 꽉 채우는 이미지 */
function fullImage(src) {
  return {
    id: nextId(),
    type: "image",
    x: 0,
    y: 0,
    width: SLIDE_W,
    height: SLIDE_H,
    src,
    objectFit: "cover",
  };
}

/** 하단 자막 띠 위에 올리는 제목 + 부제 */
function captionBlock(title, subtitle) {
  return [
    {
      id: nextId(),
      type: "shape",
      x: 0,
      y: 372,
      width: SLIDE_W,
      height: 168,
      shapeKind: "rect",
      fill: "#0b1220",
      stroke: "transparent",
      strokeWidth: 0,
      opacity: 0.55,
    },
    {
      id: nextId(),
      type: "text",
      x: 64,
      y: 404,
      width: 832,
      text: title,
      fontSize: 42,
      fill: "#ffffff",
    },
    {
      id: nextId(),
      type: "text",
      x: 64,
      y: 462,
      width: 832,
      text: subtitle,
      fontSize: 20,
      fill: "#dbe3f4",
    },
  ];
}

/** 광고 구좌 — id는 광고 재생 로그에서 참조하므로 고정값을 쓴다 */
function adSlot(id, name, x, y, w, h) {
  return {
    id,
    type: "adSlot",
    x,
    y,
    width: w,
    height: h,
    adSlotName: name,
    adSlotSec: 15,
    adSlotFill: "house",
  };
}

/**
 * 시드 북 정의. `m(key)` 는 `{ src, poster }` 를 돌려준다.
 * `adSlots` 는 광고 리포트가 참조할 구좌 element id 목록.
 */
export function buildBooks(m) {
  return [
    {
      key: "intro",
      title: "크레타 리조트 브랜드 인트로",
      adSlots: [{ id: "adslot-intro-lower", name: "브랜드 인트로 하단 구좌" }],
      pages: [
        {
          name: "시그니처 모션",
          background: "#04120f",
          transition: "fade",
          holdSec: 12,
          elements: [
            fullVideo(m("goldmotion")),
            ...captionBlock(
              "CRETA RESORT",
              "머무는 순간이 풍경이 되는 곳 — 크레타 리조트에 오신 것을 환영합니다.",
            ),
          ],
        },
        {
          name: "웰컴 보드",
          background: "#04120f",
          transition: "fade",
          holdSec: 10,
          elements: [
            fullImage(m("goldmotion").poster),
            {
              id: nextId(),
              type: "text",
              x: 64,
              y: 96,
              width: 620,
              text: "오늘의 안내",
              fontSize: 48,
              fill: "#f6d38a",
            },
            {
              id: nextId(),
              type: "text",
              x: 64,
              y: 176,
              width: 620,
              text: "체크인 15:00 · 체크아웃 11:00\n조식 뷔페 06:30–10:30 (2F 다이닝)\n루프탑 바 17:00–24:00 (21F)",
              fontSize: 24,
              fill: "#e8eef8",
            },
            adSlot(
              "adslot-intro-lower",
              "브랜드 인트로 하단 구좌",
              620,
              300,
              300,
              180,
            ),
          ],
        },
      ],
    },
    {
      key: "iceland",
      title: "아이슬란드 블랙샌드 비치",
      pages: [
        {
          name: "블랙샌드 비치",
          background: "#0a0e14",
          transition: "fade",
          holdSec: 20,
          elements: [
            fullVideo(m("iceland")),
            ...captionBlock(
              "Vestrahorn, Iceland",
              "검은 화산 모래와 이끼, 그리고 새벽의 산 능선 — 라운지 앰비언트 루프",
            ),
          ],
        },
        {
          name: "여행 안내",
          background: "#0a0e14",
          transition: "slideLeft",
          holdSec: 10,
          elements: [
            fullImage(m("iceland").poster),
            ...captionBlock(
              "겨울 오로라 시즌 9월–3월",
              "프런트 데스크에서 아이슬란드 투어 패키지를 안내해 드립니다.",
            ),
          ],
        },
      ],
    },
    {
      key: "cloudsea",
      title: "운해 위 일출 트레킹",
      pages: [
        {
          name: "운해 일출",
          background: "#10141c",
          transition: "fade",
          holdSec: 15,
          elements: [
            fullVideo(m("cloudsea")),
            ...captionBlock(
              "구름 위에서 맞는 아침",
              "모닝 오프닝 편성 — 07:00부터 로비와 프런트에서 재생됩니다.",
            ),
          ],
        },
        {
          name: "새벽 산행 안내",
          background: "#10141c",
          transition: "fade",
          holdSec: 10,
          elements: [
            fullImage(m("cloudsea").poster),
            ...captionBlock(
              "선라이즈 트레킹 05:30 집합",
              "1F 로비 · 왕복 3시간 · 방한 재킷과 헤드랜턴을 대여해 드립니다.",
            ),
          ],
        },
      ],
    },
    {
      key: "emerald",
      title: "에메랄드 코스트 항공뷰",
      pages: [
        {
          name: "에메랄드 코스트",
          background: "#052b33",
          transition: "fade",
          holdSec: 14,
          elements: [
            fullVideo(m("emerald")),
            ...captionBlock(
              "Emerald Coast",
              "얕은 산호와 바위 해안을 위에서 내려다본 항공 촬영",
            ),
          ],
        },
        {
          name: "스노클링 안내",
          background: "#052b33",
          transition: "fade",
          holdSec: 10,
          elements: [
            fullImage(m("emerald").poster),
            ...captionBlock(
              "스노클링 데이 투어",
              "매일 09:00 · 13:00 출발 · 장비 포함 · 리조트 투숙객 20% 할인",
            ),
          ],
        },
      ],
    },
    {
      key: "alpine",
      title: "알파인 설산 파노라마",
      pages: [
        {
          name: "설산 파노라마",
          background: "#0d1a26",
          transition: "fade",
          holdSec: 14,
          elements: [
            fullVideo(m("alpine")),
            ...captionBlock(
              "Alpine Panorama",
              "만년설과 침엽수림 — 피트니스·비디오월 공통 배경",
            ),
          ],
        },
        {
          name: "트레일 코스",
          background: "#0d1a26",
          transition: "slideLeft",
          holdSec: 10,
          elements: [
            fullImage(m("alpine").poster),
            ...captionBlock(
              "리조트 트레일 3코스",
              "숲길 2.4km · 능선 5.8km · 전망대 8.1km — 지도는 프런트에서",
            ),
          ],
        },
      ],
    },
    {
      key: "summersky",
      title: "여름 하늘 라운지",
      adSlots: [{ id: "adslot-lounge-side", name: "라운지 사이드 구좌" }],
      pages: [
        {
          name: "여름 하늘",
          background: "#0a2a44",
          transition: "fade",
          holdSec: 12,
          elements: [
            fullVideo(m("summersky")),
            ...captionBlock(
              "Summer Sky",
              "야자수와 뭉게구름 — 카페·라운지 낮 시간대 루프",
            ),
          ],
        },
        {
          name: "라운지 메뉴",
          background: "#0a2a44",
          transition: "fade",
          holdSec: 12,
          elements: [
            fullImage(m("summersky").poster),
            {
              id: nextId(),
              type: "text",
              x: 56,
              y: 72,
              width: 520,
              text: "라운지 시그니처",
              fontSize: 40,
              fill: "#ffffff",
            },
            {
              id: nextId(),
              type: "text",
              x: 56,
              y: 144,
              width: 520,
              text: "콜드브루 토닉 8,000원\n제주 말차 라떼 8,500원\n시즌 과일 에이드 9,000원",
              fontSize: 24,
              fill: "#e6f1fb",
            },
            adSlot(
              "adslot-lounge-side",
              "라운지 사이드 구좌",
              600,
              120,
              320,
              300,
            ),
          ],
        },
      ],
    },
    {
      key: "holiday",
      title: "홀리데이 시즌 프로모션",
      adSlots: [{ id: "adslot-holiday-bottom", name: "홀리데이 하단 구좌" }],
      pages: [
        {
          name: "홀리데이 인사",
          background: "#3a0f14",
          transition: "fade",
          holdSec: 10,
          elements: [
            fullImage(m("holiday").src),
            {
              id: nextId(),
              type: "text",
              x: 430,
              y: 150,
              width: 470,
              text: "Happy Holidays",
              fontSize: 52,
              fill: "#f7e7c6",
            },
            {
              id: nextId(),
              type: "text",
              x: 430,
              y: 236,
              width: 470,
              text: "12월 한 달, 크레타 리조트의 겨울 이야기가 시작됩니다.",
              fontSize: 22,
              fill: "#f3d8d8",
            },
          ],
        },
        {
          name: "패키지 안내",
          background: "#3a0f14",
          transition: "fade",
          holdSec: 12,
          elements: [
            fullImage(m("holiday").src),
            {
              id: nextId(),
              type: "text",
              x: 430,
              y: 96,
              width: 470,
              text: "윈터 스테이 패키지",
              fontSize: 40,
              fill: "#f7e7c6",
            },
            {
              id: nextId(),
              type: "text",
              x: 430,
              y: 168,
              width: 470,
              text: "디럭스 1박 + 조식 2인\n루프탑 바 웰컴 드링크\n스파 60분 트리트먼트",
              fontSize: 22,
              fill: "#f3d8d8",
            },
            adSlot(
              "adslot-holiday-bottom",
              "홀리데이 하단 구좌",
              60,
              380,
              340,
              130,
            ),
          ],
        },
        {
          name: "예약 안내",
          background: "#3a0f14",
          transition: "fade",
          holdSec: 8,
          elements: [
            fullImage(m("holiday").src),
            ...captionBlock(
              "예약 문의 1544-0000",
              "12월 1일–12월 31일 · 객실 한정 · 프런트 데스크 및 공식 홈페이지",
            ),
          ],
        },
      ],
    },
  ];
}

// ── 플레이리스트 ────────────────────────────────────────────────────

export const PLAYLISTS = [
  {
    key: "lobby",
    name: "로비 상시 루프",
    description:
      "브랜드 인트로로 시작해 설산·아이슬란드 풍경으로 이어지는 로비 기본 편성",
    visibility: "전체 공개",
    loop: true,
    books: ["intro", "alpine", "iceland"],
  },
  {
    key: "lounge",
    name: "라운지 앰비언트",
    description: "저녁 라운지·루프탑 바에서 트는 잔잔한 자연 풍경 루프",
    visibility: "전체 공개",
    loop: true,
    books: ["summersky", "emerald"],
  },
  {
    key: "morning",
    name: "모닝 오프닝",
    description:
      "07:00 개점 시간대 — 운해 일출로 열고 브랜드 인트로로 닫는 편성",
    visibility: "전체 공개",
    loop: true,
    books: ["cloudsea", "summersky", "intro"],
  },
  {
    key: "holiday",
    name: "홀리데이 시즌",
    description: "12월 프로모션 전용 — 홀리데이 배너와 겨울 풍경",
    visibility: "멤버 공개",
    loop: true,
    books: ["holiday", "intro", "alpine"],
  },
  {
    key: "fitness",
    name: "피트니스 하이에너지",
    description: "3F 피트니스 라운지 — 설산·해안 항공뷰로 구성한 활동적인 루프",
    visibility: "멤버 공개",
    loop: true,
    books: ["alpine", "emerald"],
  },
  {
    key: "cafe",
    name: "카페 슬로우 루프",
    description: "2F 카페 — 느린 호흡의 바다·하늘 풍경",
    visibility: "전체 공개",
    loop: true,
    books: ["iceland", "summersky", "emerald"],
  },
];

// ── 스케줄 ──────────────────────────────────────────────────────────

const hm = (h, m = 0) => h * 60 + m;

export const SCHEDULES = [
  {
    key: "lobbyWeekday",
    name: "로비 평일 편성",
    defaultSourceType: "playlist",
    defaultPlaylist: "lobby",
    autoApply: true,
    slots: [
      {
        start: hm(7),
        end: hm(11),
        source: "playlist",
        playlist: "morning",
        repeat: "weekday",
      },
      {
        start: hm(11),
        end: hm(18),
        source: "playlist",
        playlist: "lobby",
        repeat: "weekday",
      },
      {
        start: hm(18),
        end: hm(23),
        source: "playlist",
        playlist: "lounge",
        repeat: "weekday",
      },
    ],
  },
  {
    key: "weekend",
    name: "주말 특별 편성",
    defaultSourceType: "playlist",
    defaultPlaylist: "lounge",
    autoApply: true,
    slots: [
      {
        start: hm(9),
        end: hm(13),
        source: "playlist",
        playlist: "cafe",
        repeat: "weekend",
      },
      {
        start: hm(13),
        end: hm(19),
        source: "playlist",
        playlist: "lobby",
        repeat: "weekend",
      },
      {
        start: hm(19),
        end: hm(24),
        source: "playlist",
        playlist: "lounge",
        repeat: "weekend",
      },
    ],
  },
  {
    key: "holiday",
    name: "홀리데이 시즌 편성",
    defaultSourceType: "book",
    defaultBook: "holiday",
    autoApply: false,
    slots: [
      {
        start: hm(10),
        end: hm(22),
        source: "playlist",
        playlist: "holiday",
        repeat: "range",
        repeatStart: "2026-12-01",
        repeatEnd: "2026-12-31",
      },
      {
        start: hm(22),
        end: hm(24),
        source: "book",
        book: "alpine",
        repeat: "range",
        repeatStart: "2026-12-01",
        repeatEnd: "2026-12-31",
      },
    ],
  },
  {
    key: "cafe",
    name: "카페 영업시간 편성",
    defaultSourceType: "none",
    autoApply: true,
    slots: [
      {
        start: hm(8),
        end: hm(11),
        source: "playlist",
        playlist: "morning",
        repeat: "daily",
      },
      {
        start: hm(11),
        end: hm(22),
        source: "playlist",
        playlist: "cafe",
        repeat: "daily",
      },
    ],
  },
  {
    key: "fitness",
    name: "피트니스 24시 편성",
    defaultSourceType: "playlist",
    defaultPlaylist: "fitness",
    autoApply: true,
    slots: [
      {
        start: hm(5),
        end: hm(12),
        source: "playlist",
        playlist: "fitness",
        repeat: "daily",
      },
      {
        start: hm(12),
        end: hm(24),
        source: "book",
        book: "alpine",
        repeat: "daily",
      },
    ],
  },
];

// ── 디바이스 ────────────────────────────────────────────────────────

export const DEVICES = [
  {
    key: "wallA",
    name: "로비 메인 월 A",
    location: "1F 로비 정면",
    platform: "Windows",
    resolution: "3840×2160",
    orientation: "가로",
    online: true,
    health: "ok",
    source: { type: "schedule", key: "lobbyWeekday" },
    tags: ["로비", "1F", "비디오월"],
    powerOnTime: "06:00",
    powerOffTime: "23:59",
    volume: 40,
    brightness: 85,
    playerVersion: "v1.2.0",
  },
  {
    key: "wallB",
    name: "로비 메인 월 B",
    location: "1F 로비 정면",
    platform: "Windows",
    resolution: "3840×2160",
    orientation: "가로",
    online: true,
    health: "ok",
    source: { type: "schedule", key: "lobbyWeekday" },
    tags: ["로비", "1F", "비디오월"],
    powerOnTime: "06:00",
    powerOffTime: "23:59",
    volume: 40,
    brightness: 85,
    playerVersion: "v1.2.0",
  },
  {
    key: "wallC",
    name: "로비 메인 월 C",
    location: "1F 로비 정면",
    platform: "Windows",
    resolution: "3840×2160",
    orientation: "가로",
    online: true,
    health: "ok",
    source: { type: "schedule", key: "lobbyWeekday" },
    tags: ["로비", "1F", "비디오월"],
    powerOnTime: "06:00",
    powerOffTime: "23:59",
    volume: 40,
    brightness: 85,
    playerVersion: "v1.2.0",
  },
  {
    key: "wallD",
    name: "로비 메인 월 D",
    location: "1F 로비 정면",
    platform: "Windows",
    resolution: "3840×2160",
    orientation: "가로",
    online: true,
    health: "ok",
    source: { type: "schedule", key: "lobbyWeekday" },
    tags: ["로비", "1F", "비디오월"],
    powerOnTime: "06:00",
    powerOffTime: "23:59",
    volume: 40,
    brightness: 82,
    playerVersion: "v1.1.0",
  },
  {
    key: "front",
    name: "프런트 데스크 사이니지",
    location: "1F 프런트",
    platform: "Android",
    resolution: "1080×1920",
    orientation: "세로",
    online: true,
    health: "ok",
    source: { type: "book", key: "intro" },
    tags: ["로비", "1F", "세로"],
    powerOnTime: "06:00",
    powerOffTime: "23:00",
    volume: 25,
    brightness: 90,
    playerVersion: "v1.2.0",
  },
  {
    key: "cafe",
    name: "카페 메뉴보드",
    location: "2F 카페",
    platform: "WebOS",
    resolution: "1920×1080",
    orientation: "가로",
    online: true,
    health: "ok",
    source: { type: "schedule", key: "cafe" },
    tags: ["카페", "2F"],
    powerOnTime: "07:30",
    powerOffTime: "22:30",
    volume: 15,
    brightness: 75,
    playerVersion: "v1.2.0",
  },
  {
    key: "fitness",
    name: "피트니스 라운지",
    location: "3F 피트니스",
    platform: "Tizen",
    resolution: "1920×1080",
    orientation: "가로",
    online: true,
    health: "ok",
    source: { type: "playlist", key: "fitness" },
    tags: ["피트니스", "3F"],
    powerOnTime: "05:00",
    powerOffTime: "23:59",
    volume: 55,
    brightness: 80,
    playerVersion: "v1.1.0",
  },
  {
    key: "banquet",
    name: "연회장 입구",
    location: "2F 연회장",
    platform: "Windows",
    resolution: "1920×1080",
    orientation: "가로",
    online: false,
    health: "ok",
    source: { type: "playlist", key: "holiday" },
    tags: ["연회장", "2F"],
    powerOnTime: "09:00",
    powerOffTime: "22:00",
    // 연회 없는 월요일과 신정 연휴는 전원 예약에서 제외
    powerExcludeDays: "1",
    powerExcludeDates: "2027-01-01,2027-01-02",
    volume: 30,
    brightness: 70,
    playerVersion: "v1.0.6",
  },
  {
    key: "parking",
    name: "주차장 안내판 B2",
    location: "B2 주차장",
    platform: "Android",
    resolution: "1080×1920",
    orientation: "세로",
    online: true,
    health: "error",
    source: { type: "book", key: "alpine" },
    tags: ["주차장", "B2", "세로"],
    volume: 0,
    brightness: 100,
    playerVersion: "v1.0.6",
  },
  {
    key: "rooftop",
    name: "루프탑 바",
    location: "21F 루프탑",
    platform: "WebOS",
    resolution: "3840×2160",
    orientation: "가로",
    online: true,
    health: "ok",
    source: { type: "playlist", key: "lounge" },
    tags: ["루프탑", "21F"],
    powerOnTime: "16:30",
    powerOffTime: "24:00",
    volume: 45,
    brightness: 65,
    playerVersion: "v1.2.0",
  },
];

// ── 비디오월 ────────────────────────────────────────────────────────

export const WALLS = [
  {
    name: "로비 메인 비디오월",
    mode: "tile",
    rows: 2,
    cols: 2,
    book: "alpine",
    slideSec: 8,
    members: [
      { device: "wallA", master: true },
      { device: "wallB" },
      { device: "wallC" },
      { device: "wallD" },
    ],
  },
  {
    name: "연회장 미러월",
    mode: "mirror",
    rows: 1,
    cols: 2,
    book: "holiday",
    slideSec: 10,
    members: [{ device: "banquet", master: true }, { device: "rooftop" }],
  },
  {
    name: "카페·피트니스 멀티월",
    mode: "multi",
    rows: 1,
    cols: 2,
    book: null,
    slideSec: 12,
    members: [
      { device: "cafe", master: true, book: "summersky" },
      { device: "fitness", book: "alpine" },
    ],
  },
  {
    name: "세로 듀오월 (프런트·주차장)",
    mode: "mirror",
    rows: 1,
    cols: 2,
    book: "intro",
    slideSec: 9,
    members: [{ device: "front", master: true }, { device: "parking" }],
  },
  {
    name: "루프탑 선셋월",
    mode: "tile",
    rows: 1,
    cols: 2,
    book: "emerald",
    slideSec: 14,
    members: [{ device: "rooftop", master: true }, { device: "cafe" }],
  },
];

// ── 광고 ────────────────────────────────────────────────────────────

export const AD_SETTING = {
  loopEveryN: 5,
  spotSec: 15,
  houseName: "크레타 리조트 하우스 광고",
  houseKind: "image",
  houseMedia: "holiday",
};

export const ADVERTISERS = [
  {
    key: "iceland",
    name: "아이슬란드 관광청",
    contact: "Kristín Jónsdóttir · partner@visiticeland.example",
  },
  {
    key: "skyline",
    name: "스카이라인 항공",
    contact: "김도현 팀장 · ads@skyline-air.example",
  },
  {
    key: "terra",
    name: "테라 아웃도어",
    contact: "박서준 매니저 · partner@terra-outdoor.example",
  },
  {
    key: "lagoon",
    name: "블루라군 스파",
    contact: "이수민 · biz@bluelagoon-spa.example",
  },
  {
    key: "greenbird",
    name: "그린버드 카페",
    contact: "최유진 · hello@greenbird.example",
  },
];

export const CAMPAIGNS = [
  {
    key: "icelandWinter",
    advertiser: "iceland",
    name: "아이슬란드 겨울 캠페인",
    status: "live",
    startDate: "2026-08-01",
    endDate: "2026-12-31",
    weight: 8,
    cpm: 12000,
    dayTarget: "all",
    startMin: null,
    endMin: null,
    maxPerHour: null,
  },
  {
    key: "skylineWinter",
    advertiser: "skyline",
    name: "동계 스케줄 프로모션",
    status: "live",
    startDate: "2026-08-10",
    endDate: "2026-11-30",
    weight: 6,
    cpm: 15000,
    dayTarget: "weekday",
    startMin: hm(6),
    endMin: hm(11),
    maxPerHour: 6,
  },
  {
    key: "terraFw",
    advertiser: "terra",
    name: "알파인 컬렉션 FW",
    status: "live",
    startDate: "2026-07-01",
    endDate: "2026-10-31",
    weight: 5,
    cpm: 9000,
    dayTarget: "all",
    startMin: null,
    endMin: null,
    maxPerHour: null,
  },
  {
    key: "lagoonSummer",
    advertiser: "lagoon",
    name: "여름 스파 패키지",
    status: "paused",
    startDate: "2026-06-01",
    endDate: "2026-09-15",
    weight: 3,
    cpm: 7000,
    dayTarget: "weekend",
    startMin: null,
    endMin: null,
    maxPerHour: null,
  },
  {
    key: "greenbirdMorning",
    advertiser: "greenbird",
    name: "모닝 브루 타임",
    status: "live",
    startDate: "2026-08-01",
    endDate: "2026-09-30",
    weight: 4,
    cpm: 5000,
    dayTarget: "all",
    startMin: hm(7),
    endMin: hm(11),
    maxPerHour: 10,
  },
  {
    key: "icelandAurora",
    advertiser: "iceland",
    name: "오로라 시즌 티저",
    status: "live",
    startDate: "2026-09-01",
    endDate: "2027-01-31",
    weight: 7,
    cpm: 13000,
    dayTarget: "all",
    startMin: null,
    endMin: null,
    maxPerHour: null,
  },
  {
    key: "skylineWeekend",
    advertiser: "skyline",
    name: "주말 특가 노선",
    status: "live",
    startDate: "2026-08-15",
    endDate: "2026-10-15",
    weight: 4,
    cpm: 11000,
    dayTarget: "weekend",
    startMin: hm(12),
    endMin: hm(20),
    maxPerHour: null,
  },
];

export const CREATIVES = [
  {
    campaign: "icelandWinter",
    name: "블랙샌드 비치 15초",
    kind: "video",
    media: "iceland",
    status: "approved",
    position: 0,
  },
  {
    campaign: "icelandWinter",
    name: "블랙샌드 스틸컷",
    kind: "image",
    media: "iceland",
    poster: true,
    status: "approved",
    position: 1,
  },
  {
    campaign: "skylineWinter",
    name: "운해 일출 티저",
    kind: "video",
    media: "cloudsea",
    status: "approved",
    position: 0,
  },
  {
    campaign: "skylineWinter",
    name: "구름 위 스틸컷",
    kind: "image",
    media: "cloudsea",
    poster: true,
    status: "pending",
    position: 1,
  },
  {
    campaign: "terraFw",
    name: "설산 파노라마 12초",
    kind: "video",
    media: "alpine",
    status: "approved",
    position: 0,
  },
  {
    campaign: "terraFw",
    name: "설산 스틸컷",
    kind: "image",
    media: "alpine",
    poster: true,
    status: "rejected",
    position: 1,
  },
  {
    campaign: "lagoonSummer",
    name: "에메랄드 코스트 항공뷰",
    kind: "video",
    media: "emerald",
    status: "approved",
    position: 0,
  },
  {
    campaign: "greenbirdMorning",
    name: "여름 하늘 라운지",
    kind: "video",
    media: "summersky",
    status: "approved",
    position: 0,
  },
  {
    campaign: "icelandAurora",
    name: "골드 시그니처 모션",
    kind: "video",
    media: "goldmotion",
    status: "approved",
    position: 0,
  },
  {
    campaign: "skylineWeekend",
    name: "홀리데이 배너",
    kind: "image",
    media: "holiday",
    status: "approved",
    position: 0,
  },
];

export const AD_AUDIT_LOGS = [
  {
    entityKind: "advertiser",
    entityName: "아이슬란드 관광청",
    action: "create",
    detail: "광고주 등록",
    daysAgo: 26,
  },
  {
    entityKind: "campaign",
    entityName: "아이슬란드 겨울 캠페인",
    action: "create",
    detail: "2026-08-01 ~ 2026-12-31 · CPM 12,000원",
    daysAgo: 25,
  },
  {
    entityKind: "creative",
    entityName: "블랙샌드 비치 15초",
    action: "approve",
    detail: "심의 통과 — 편성 투입",
    daysAgo: 24,
  },
  {
    entityKind: "campaign",
    entityName: "여름 스파 패키지",
    action: "update",
    detail: "라이브 → 일시중지",
    daysAgo: 12,
  },
  {
    entityKind: "creative",
    entityName: "설산 스틸컷",
    action: "reject",
    detail: "로고 잘림 — 재입고 요청",
    daysAgo: 9,
  },
  {
    entityKind: "setting",
    entityName: "광고 전역 설정",
    action: "update",
    detail: "루프 삽입 5페이지마다 · 스팟 15초",
    daysAgo: 6,
  },
  {
    entityKind: "campaign",
    entityName: "주말 특가 노선",
    action: "create",
    detail: "주말 12:00~20:00 타기팅",
    daysAgo: 4,
  },
];

// ── 긴급 알림(이력) ─────────────────────────────────────────────────

export const ALERTS = [
  {
    message: "2F 연회장 정기 점검으로 09:00~11:00 재생이 중단됩니다.",
    level: "안내",
    allDevices: false,
    devices: ["banquet"],
    daysAgo: 11,
    durationMin: 120,
  },
  {
    message: "B2 주차장 안내판 신호 불량 — 현장 점검 요청",
    level: "주의",
    allDevices: false,
    devices: ["parking"],
    daysAgo: 6,
    durationMin: 240,
  },
  {
    message: "소방 점검 안내 — 전 층 사이니지 일시 정지",
    level: "긴급",
    allDevices: true,
    devices: [],
    daysAgo: 3,
    durationMin: 45,
  },
  {
    message: "루프탑 바 우천으로 금일 영업 종료 (21:00)",
    level: "안내",
    allDevices: false,
    devices: ["rooftop"],
    daysAgo: 2,
    durationMin: 180,
  },
];
