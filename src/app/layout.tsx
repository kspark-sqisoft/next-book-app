// 전역 스타일(테마·Tailwind 엔트리)
import "./globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

// 클라이언트: React Query·테마·auth hydrate
import { Providers } from "./providers";

// CSS 변수로 노출해 tailwind/font-family에서 참조
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "next-book-app",
  description: "Next.js + Drizzle + tRPC + PostgreSQL",
};

// 앱 전체 래퍼: html/body는 서버 컴포넌트
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning // next-themes 등으로 class 변경 시 하이드레이션 경고 억제
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
