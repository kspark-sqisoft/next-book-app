"use client";

// 위젯 종류 아이콘 — 위젯 메뉴(팔레트)와 같은 아이콘을 캔버스 배지 등에서 재사용
import {
  BadgeDollarSign,
  CalendarDays,
  ChartColumn,
  Clock,
  CloudSun,
  Globe,
  ImagePlus,
  Layers,
  ListVideo,
  type LucideIcon,
  MapPin,
  Megaphone,
  Newspaper,
  Pencil,
  QrCode,
  Shapes,
  SquarePlay,
  Type,
  Video,
} from "lucide-react";

import type { BookCanvasElement } from "@/lib/book-canvas";

const ICON: Record<BookCanvasElement["type"], LucideIcon> = {
  text: Type,
  image: ImagePlus,
  video: Video,
  weather: CloudSun,
  news: Newspaper,
  mediaPlaylist: ListVideo,
  digitalClock: Clock,
  webview: Globe,
  map: MapPin,
  calendar: CalendarDays,
  qr: QrCode,
  chart: ChartColumn,
  ticker: Megaphone,
  youtube: SquarePlay,
  drawing: Pencil,
  shape: Shapes,
  adSlot: BadgeDollarSign,
};

export const BOOK_ELEMENT_TYPE_LABEL: Record<
  BookCanvasElement["type"],
  string
> = {
  text: "텍스트",
  image: "이미지",
  video: "동영상",
  weather: "날씨",
  news: "뉴스",
  mediaPlaylist: "미디어",
  digitalClock: "디지털 시계",
  webview: "웹뷰",
  map: "지도",
  calendar: "캘린더",
  qr: "QR코드",
  chart: "차트",
  ticker: "티커",
  youtube: "유튜브",
  drawing: "그리기",
  shape: "도형",
  adSlot: "광고",
};

export function BookElementTypeIcon({
  type,
  className,
}: {
  type: BookCanvasElement["type"];
  className?: string;
}) {
  const Icon = ICON[type] ?? Layers;
  return <Icon className={className} aria-hidden />;
}
