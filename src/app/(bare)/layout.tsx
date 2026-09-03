// (bare) 그룹: 사이트 헤더·푸터 없이 어두운 전체 화면 — 슬라이드쇼처럼 iframe 에 박히거나
// 전체 화면으로 여는 라우트.
//
// 미리보기가 (site) 안에 있을 때는 iframe 안에 **밝은 헤더가 먼저 칠해지고**, 북을 받는
// 동안 밝은 배경의 스피너가 떴다가, 슬라이드쇼가 검은 포털로 덮으면서 흰색이 번쩍였다.
// 첫 페인트부터 어두워야 그 순간이 없다.
export default function BareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 [color-scheme:dark]">
      {children}
    </div>
  );
}
