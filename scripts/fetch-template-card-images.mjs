#!/usr/bin/env node
/**
 * Fills `public/cards/img1.jpg` … `img10.jpg` for HomeHeroCards3D and book templates.
 * Source: Lorem Picsum (stable per seed). Run: `npm run setup:assets`
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "cards");

await mkdir(outDir, { recursive: true });

for (let i = 1; i <= 10; i += 1) {
  const url = `https://picsum.photos/seed/nextbook-card-${i}/518/800`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(join(outDir, `img${i}.jpg`), buf);
  process.stdout.write(`wrote public/cards/img${i}.jpg (${buf.length} bytes)\n`);
}
