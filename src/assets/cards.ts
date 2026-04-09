/** `public/cards/img1.jpg` … `img10.jpg` (정적 경로 `/cards/…`) */
export const cardImages: string[] = Array.from(
  { length: 10 },
  (_, i) => `/cards/img${i + 1}.jpg`,
);
