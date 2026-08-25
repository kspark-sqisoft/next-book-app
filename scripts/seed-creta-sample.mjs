#!/usr/bin/env node
// 크레타 샘플 데이터 시드.
//
//   node scripts/seed-creta-sample.mjs [--media <원본 폴더>] [--upload-root <업로드 루트>]
//                                      [--owner-email <계정 이메일>]
//
// 1) 원본 폴더(기본 ~/Downloads)의 이미지·영상을 업로드 폴더로 복사하고 포스터를 뽑는다.
//    앱 업로드 상한(150MB)을 넘는 4K 원본은 1080p로 변환한다.
//    업로드 폴더에 준비된 파일이 이미 있으면 원본 없이도 동작한다(다른 PC로 옮길 때).
// 2) 스튜디오(북)·플레이리스트·스케줄·디바이스·비디오월·광고·재생 이력을 채운다.
//    소유자는 --owner-email(또는 SEED_OWNER_EMAIL) 계정, 없으면 가장 먼저 만든 계정.
//
// 다시 실행해도 안전하다 — 시드가 만든 행만 이름으로 찾아 지우고 새로 넣는다.
// 사용자가 직접 만든 북·디바이스는 건드리지 않는다.
//
// 도커로 띄운 앱에 넣을 때는 DB 포트가 열려 있으므로 호스트에서 그대로 실행하고,
// 업로드 파일만 컨테이너 볼륨으로 복사한다:
//
//   DB_HOST=127.0.0.1 node scripts/seed-creta-sample.mjs --upload-root ./uploads
//   docker cp uploads/. next-book-app-app-1:/app/uploads/
//   docker compose exec -u root app chown -R nextjs:nodejs /app/uploads
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import postgres from "postgres";

import {
  AD_AUDIT_LOGS,
  AD_SETTING,
  ADVERTISERS,
  ALERTS,
  buildBooks,
  CAMPAIGNS,
  CREATIVES,
  DEVICES,
  MEDIA,
  PLAYLISTS,
  SCHEDULES,
  SLIDE_H,
  SLIDE_W,
  WALLS,
} from "./seed-creta-sample.data.mjs";

const require = createRequire(import.meta.url);

const BOOK_IMAGES_SUBDIR = "book-images";
const BOOK_VIDEOS_SUBDIR = "book-videos";
const BOOK_VIDEO_POSTERS_SUBDIR = "book-video-posters";
/** 페이지당 기본 재생 초 — creta-play-log.service.ts 의 SEC_PER_PAGE 와 맞춤 */
const SEC_PER_PAGE = 8;
/** 재생 이력을 채울 기간(일). 최근 48시간은 앱이 조회 시점에 스스로 채운다 */
const PLAY_LOG_DAYS = 10;
/** 하루에 남길 재생 이력 블록 길이(분) — 피크 시간대 한 블록 */
const PLAY_LOG_BLOCK_MIN = 60;
/** 광고 노출 로그 기간(일) */
const AD_LOG_DAYS = 30;

function parseArgs(argv) {
  const out = {
    media: join(homedir(), "Downloads"),
    uploadRoot: null,
    ownerEmail: process.env.SEED_OWNER_EMAIL?.trim() || null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--media") out.media = resolve(argv[++i] ?? "");
    else if (argv[i] === "--upload-root")
      out.uploadRoot = resolve(argv[++i] ?? "");
    else if (argv[i] === "--owner-email") out.ownerEmail = argv[++i] ?? null;
  }
  out.uploadRoot ??= resolve(
    process.env.UPLOAD_ROOT?.trim() || join(process.cwd(), "uploads"),
  );
  return out;
}

function ffmpegPath() {
  try {
    return require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    return "ffmpeg";
  }
}

function runFfmpeg(args) {
  const r = spawnSync(
    ffmpegPath(),
    ["-hide_banner", "-loglevel", "error", ...args],
    {
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  if (r.status !== 0) {
    throw new Error(`ffmpeg 실패: ${args.join(" ")}`);
  }
}

// ── 1. 미디어 준비 ──────────────────────────────────────────────────

/**
 * 원본을 업로드 폴더로 옮기고 영상 포스터를 만든다.
 * 이미 있는 결과물은 다시 만들지 않는다(재실행 시 변환 시간 절약).
 */
async function prepareMedia({ mediaDir, uploadRoot }) {
  const imagesDir = join(uploadRoot, BOOK_IMAGES_SUBDIR);
  const videosDir = join(uploadRoot, BOOK_VIDEOS_SUBDIR);
  const postersDir = join(uploadRoot, BOOK_VIDEO_POSTERS_SUBDIR);
  await mkdir(imagesDir, { recursive: true });
  await mkdir(videosDir, { recursive: true });
  await mkdir(postersDir, { recursive: true });

  const resolved = new Map();
  for (const item of MEDIA) {
    const source = join(mediaDir, item.source);
    // 준비된 결과물이 이미 있으면 원본은 필요 없다 — 다른 PC로 uploads/ 만 옮겨 와도 동작한다
    const requireSource = () => {
      if (!existsSync(source)) {
        throw new Error(
          `원본 미디어도, 준비된 파일도 없습니다: ${source}\n` +
            `  (원본 폴더를 --media 로 지정하거나, 준비된 uploads/ 를 --upload-root 에 두세요)`,
        );
      }
      return source;
    };

    if (item.kind === "image") {
      const dest = join(imagesDir, item.file);
      if (!existsSync(dest)) await copyFile(requireSource(), dest);
      resolved.set(item.key, {
        kind: "image",
        label: item.label,
        src: `/uploads/${BOOK_IMAGES_SUBDIR}/${item.file}`,
        poster: `/uploads/${BOOK_IMAGES_SUBDIR}/${item.file}`,
      });
      continue;
    }

    const dest = join(videosDir, item.file);
    if (!existsSync(dest)) {
      if (item.transcodeTo1080p) {
        const src = requireSource();
        const mb = Math.round((await stat(src)).size / (1024 * 1024));
        console.log(`  · ${basename(src)} (${mb}MB) → 1080p 변환 중…`);
        runFfmpeg([
          "-i",
          src,
          "-vf",
          "scale=1920:-2",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "24",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-an",
          "-y",
          dest,
        ]);
      } else {
        await copyFile(requireSource(), dest);
      }
    }

    // 포스터 — 북 위젯의 posterSrc이자, 정지컷 광고 소재로도 쓴다
    const posterFile = item.file.replace(/\.mp4$/, "-poster.jpg");
    const posterDest = join(postersDir, posterFile);
    if (!existsSync(posterDest)) {
      runFfmpeg([
        "-ss",
        String(item.posterAt ?? 1),
        "-i",
        dest,
        "-frames:v",
        "1",
        "-vf",
        "scale=1280:-2",
        "-q:v",
        "3",
        "-y",
        posterDest,
      ]);
    }

    resolved.set(item.key, {
      kind: "video",
      label: item.label,
      src: `/uploads/${BOOK_VIDEOS_SUBDIR}/${item.file}`,
      poster: `/uploads/${BOOK_VIDEO_POSTERS_SUBDIR}/${posterFile}`,
    });
  }
  return resolved;
}

// ── 2. 삽입 ─────────────────────────────────────────────────────────

const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);

/** 재현 가능한 난수(시드 결과가 실행마다 크게 흔들리지 않게) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 이전 시드 결과 제거 — 이름이 정확히 일치하는 행만 지운다(자식 행은 FK cascade) */
async function clearPreviousSeed(sql, books) {
  const bookTitles = books.map((b) => b.title);
  const names = {
    playlist: PLAYLISTS.map((p) => p.name),
    schedule: SCHEDULES.map((s) => s.name),
    device: DEVICES.map((d) => d.name),
    wall: WALLS.map((w) => w.name),
    advertiser: ADVERTISERS.map((a) => a.name),
  };
  // 알림·광고 로그·감사 로그는 이름 참조가 약해 시드 대상 전체를 지운다
  await sql`DELETE FROM creta_alert`;
  await sql`DELETE FROM creta_ad_play_log`;
  await sql`DELETE FROM creta_ad_audit_log`;
  await sql`DELETE FROM creta_advertiser WHERE name = ANY(${names.advertiser})`;
  await sql`DELETE FROM creta_video_wall WHERE name = ANY(${names.wall})`;
  await sql`DELETE FROM creta_device WHERE name = ANY(${names.device})`;
  await sql`DELETE FROM creta_schedule WHERE name = ANY(${names.schedule})`;
  await sql`DELETE FROM creta_playlist WHERE name = ANY(${names.playlist})`;
  await sql`DELETE FROM book WHERE title = ANY(${bookTitles})`;
}

async function insertBooks(sql, books, media, ownerId) {
  const ids = new Map();
  const durations = new Map();
  for (const b of books) {
    const [row] = await sql`
      INSERT INTO book (title, "slideWidth", "slideHeight", "presentationLoop",
                        "authorId", "sharedToAll", status)
      VALUES (${b.title}, ${SLIDE_W}, ${SLIDE_H}, true, ${ownerId}, true, 'published')
      RETURNING id`;
    ids.set(b.key, row.id);
    durations.set(b.key, b.pages.length * SEC_PER_PAGE);

    for (const [i, page] of b.pages.entries()) {
      // 각 페이지의 첫 요소는 화면을 채우는 미디어 — 이걸 슬라이드쇼 시간 기준으로 삼는다
      const timing = page.elements[0];
      const elements = page.elements.map((el) =>
        el.id === timing.id ? { ...el, presentationHoldSec: page.holdSec } : el,
      );
      await sql`
        INSERT INTO book_page ("bookId", "sortOrder", "slideName", "elementsJson",
                               "backgroundColor", "presentationTimingElementId",
                               "presentationTransition", "presentationTransitionMs",
                               "presentationVisible")
        VALUES (${row.id}, ${i}, ${page.name}, ${JSON.stringify(elements)},
                ${page.background}, ${timing.id}, ${page.transition}, 450, true)`;
    }

    // 미디어 라이브러리 등록 — 북에서 쓴 파일만
    const used = new Set();
    for (const page of b.pages) {
      for (const el of page.elements) {
        if (el.type === "image" || el.type === "video") used.add(el.src);
      }
    }
    for (const [, item] of media) {
      if (!used.has(item.src)) continue;
      await sql`
        INSERT INTO book_media_item ("bookId", "ownerId", kind, src, "posterSrc", "sharedToAll")
        VALUES (${row.id}, ${ownerId}, ${item.kind}, ${item.src},
                ${item.kind === "video" ? item.poster : null}, true)`;
    }
  }
  return { ids, durations };
}

async function insertPlaylists(sql, bookIds, ownerId) {
  const ids = new Map();
  for (const p of PLAYLISTS) {
    const [row] = await sql`
      INSERT INTO creta_playlist (name, description, loop, visibility, "ownerId", "sharedToAll")
      VALUES (${p.name}, ${p.description}, ${p.loop}, ${p.visibility}, ${ownerId}, true)
      RETURNING id`;
    ids.set(p.key, row.id);
    for (const [i, bookKey] of p.books.entries()) {
      await sql`
        INSERT INTO creta_playlist_item ("playlistId", "bookId", position)
        VALUES (${row.id}, ${bookIds.get(bookKey)}, ${i})`;
    }
  }
  return ids;
}

async function insertSchedules(sql, bookIds, playlistIds, ownerId) {
  const ids = new Map();
  for (const s of SCHEDULES) {
    const [row] = await sql`
      INSERT INTO creta_schedule (name, "defaultSourceType", "defaultBookId",
                                  "defaultPlaylistId", "autoApply", "ownerId", "sharedToAll")
      VALUES (${s.name}, ${s.defaultSourceType},
              ${s.defaultBook ? bookIds.get(s.defaultBook) : null},
              ${s.defaultPlaylist ? playlistIds.get(s.defaultPlaylist) : null},
              ${s.autoApply}, ${ownerId}, true)
      RETURNING id`;
    ids.set(s.key, row.id);
    for (const slot of s.slots) {
      await sql`
        INSERT INTO creta_schedule_slot ("scheduleId", "startMin", "endMin", "sourceType",
                                         "bookId", "playlistId", repeat, "repeatStart", "repeatEnd")
        VALUES (${row.id}, ${slot.start}, ${slot.end}, ${slot.source},
                ${slot.book ? bookIds.get(slot.book) : null},
                ${slot.playlist ? playlistIds.get(slot.playlist) : null},
                ${slot.repeat}, ${slot.repeatStart ?? null}, ${slot.repeatEnd ?? null})`;
    }
  }
  return ids;
}

async function insertDevices(sql, { bookIds, playlistIds, scheduleIds }) {
  const ids = new Map();
  for (const d of DEVICES) {
    const src = d.source;
    const [row] = await sql`
      INSERT INTO creta_device (name, location, platform, resolution, orientation, online,
                                "sourceType", "sourceBookId", "sourcePlaylistId", "sourceScheduleId",
                                "powerOnTime", "powerOffTime", "powerExcludeDays", "powerExcludeDates",
                                health, volume, brightness, "playerVersion")
      VALUES (${d.name}, ${d.location}, ${d.platform}, ${d.resolution}, ${d.orientation},
              ${d.online}, ${src.type},
              ${src.type === "book" ? bookIds.get(src.key) : null},
              ${src.type === "playlist" ? playlistIds.get(src.key) : null},
              ${src.type === "schedule" ? scheduleIds.get(src.key) : null},
              ${d.powerOnTime ?? null}, ${d.powerOffTime ?? null},
              ${d.powerExcludeDays ?? null}, ${d.powerExcludeDates ?? null},
              ${d.health}, ${d.volume}, ${d.brightness}, ${d.playerVersion})
      RETURNING id`;
    ids.set(d.key, row.id);
    for (const tag of d.tags ?? []) {
      await sql`INSERT INTO creta_device_tag ("deviceId", tag) VALUES (${row.id}, ${tag})`;
    }
  }
  return ids;
}

async function insertWalls(sql, bookIds, deviceIds, ownerId) {
  for (const w of WALLS) {
    const [row] = await sql`
      INSERT INTO creta_video_wall (name, mode, rows, cols, "bookId", "slideSec", "ownerId")
      VALUES (${w.name}, ${w.mode}, ${w.rows}, ${w.cols},
              ${w.book ? bookIds.get(w.book) : null}, ${w.slideSec}, ${ownerId})
      RETURNING id`;
    for (const [i, m] of w.members.entries()) {
      await sql`
        INSERT INTO creta_video_wall_member ("wallId", "deviceId", position, "isMaster", "bookId")
        VALUES (${row.id}, ${deviceIds.get(m.device)}, ${i}, ${m.master === true},
                ${m.book ? bookIds.get(m.book) : null})`;
    }
  }
}

async function insertAlerts(sql, deviceIds, ownerId) {
  for (const a of ALERTS) {
    const createdAt = daysAgo(a.daysAgo);
    const endedAt = new Date(createdAt.getTime() + a.durationMin * 60 * 1000);
    const [row] = await sql`
      INSERT INTO creta_alert (message, level, "allDevices", active, "createdBy", "createdAt", "endedAt")
      VALUES (${a.message}, ${a.level}, ${a.allDevices}, false, ${ownerId}, ${createdAt}, ${endedAt})
      RETURNING id`;
    for (const key of a.devices) {
      await sql`
        INSERT INTO creta_alert_device ("alertId", "deviceId")
        VALUES (${row.id}, ${deviceIds.get(key)})`;
    }
  }
}

async function insertAds(sql, media, ownerId, adSlots) {
  const house = media.get(AD_SETTING.houseMedia);
  await sql`DELETE FROM creta_ad_setting`;
  await sql`
    INSERT INTO creta_ad_setting ("loopEveryN", "spotSec", "houseName", "houseKind", "houseSrc")
    VALUES (${AD_SETTING.loopEveryN}, ${AD_SETTING.spotSec}, ${AD_SETTING.houseName},
            ${AD_SETTING.houseKind}, ${house.src})`;

  const advertiserIds = new Map();
  for (const a of ADVERTISERS) {
    const [row] = await sql`
      INSERT INTO creta_advertiser (name, contact, "ownerId")
      VALUES (${a.name}, ${a.contact}, ${ownerId})
      RETURNING id`;
    advertiserIds.set(a.key, row.id);
  }

  const campaigns = new Map();
  for (const c of CAMPAIGNS) {
    const [row] = await sql`
      INSERT INTO creta_ad_campaign ("advertiserId", name, status, "startDate", "endDate",
                                     weight, cpm, "dayTarget", "startMin", "endMin", "maxPerHour")
      VALUES (${advertiserIds.get(c.advertiser)}, ${c.name}, ${c.status}, ${c.startDate},
              ${c.endDate}, ${c.weight}, ${c.cpm}, ${c.dayTarget},
              ${c.startMin}, ${c.endMin}, ${c.maxPerHour})
      RETURNING id`;
    campaigns.set(c.key, { id: row.id, ...c });
  }

  const creatives = [];
  for (const cr of CREATIVES) {
    const item = media.get(cr.media);
    const src = cr.poster ? item.poster : item.src;
    const campaign = campaigns.get(cr.campaign);
    const [row] = await sql`
      INSERT INTO creta_ad_creative ("campaignId", name, kind, src, status, position)
      VALUES (${campaign.id}, ${cr.name}, ${cr.kind}, ${src}, ${cr.status}, ${cr.position})
      RETURNING id`;
    creatives.push({ id: row.id, name: cr.name, status: cr.status, campaign });
  }

  for (const log of AD_AUDIT_LOGS) {
    await sql`
      INSERT INTO creta_ad_audit_log ("entityKind", "entityName", action, detail, "actorName", "createdAt")
      VALUES (${log.entityKind}, ${log.entityName}, ${log.action}, ${log.detail},
              '박기순', ${daysAgo(log.daysAgo)})`;
  }

  return insertAdPlayLogs(sql, creatives, adSlots);
}

/** 승인된 소재 × 라이브 캠페인만 구좌에서 순환 — 그 노출을 30일치 기록 */
async function insertAdPlayLogs(sql, creatives, adSlots) {
  const live = creatives.filter(
    (c) => c.status === "approved" && c.campaign.status === "live",
  );
  if (live.length === 0 || adSlots.length === 0) return 0;

  const rows = [];
  const rand = mulberry32(20260825);
  for (const [ci, creative] of live.entries()) {
    // 가중치가 높은 캠페인일수록 자주 노출된다
    const perDay = 6 + creative.campaign.weight * 2;
    for (let day = AD_LOG_DAYS; day >= 1; day -= 1) {
      const base = daysAgo(day);
      for (let n = 0; n < perDay; n += 1) {
        const slot = adSlots[(ci + n) % adSlots.length];
        const at = new Date(base);
        at.setHours(
          8 + Math.floor(rand() * 14),
          Math.floor(rand() * 60),
          Math.floor(rand() * 60),
          0,
        );
        rows.push({
          campaignId: creative.campaign.id,
          campaignName: creative.campaign.name,
          creativeId: creative.id,
          creativeName: creative.name,
          bookId: slot.bookId,
          slotElementId: slot.elementId,
          playedAt: at,
          durationSec: AD_SETTING.spotSec,
        });
      }
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await sql`INSERT INTO creta_ad_play_log ${sql(rows.slice(i, i + 500))}`;
  }
  return rows.length;
}

/**
 * 재생 이력 — 앱은 조회 시점에 최근 48시간만 채우므로(BACKFILL_WINDOW_MS),
 * 7일·30일 리포트가 비지 않도록 그 이전 구간을 하루 한 블록씩 넣어 둔다.
 */
async function insertPlayLogs(
  sql,
  { books, bookIds, playlistIds, scheduleIds, deviceIds, durations },
) {
  const contentByDevice = new Map();
  for (const d of DEVICES) {
    if (!d.online || d.source.type === "none") continue;
    const src = d.source;
    if (src.type === "book") {
      const book = books.find((b) => b.key === src.key);
      contentByDevice.set(d.key, {
        kind: "book",
        contentId: bookIds.get(src.key),
        title: book.title,
        durationSec: durations.get(src.key),
      });
    } else if (src.type === "playlist") {
      const p = PLAYLISTS.find((x) => x.key === src.key);
      contentByDevice.set(d.key, {
        kind: "playlist",
        contentId: playlistIds.get(src.key),
        title: p.name,
        durationSec: p.books.reduce((sum, k) => sum + durations.get(k), 0),
      });
    } else {
      const s = SCHEDULES.find((x) => x.key === src.key);
      // 스케줄은 시간대마다 대상이 달라, 기본 재생 길이로 대표값을 잡는다
      const first = s.slots[0];
      const durationSec = first.playlist
        ? PLAYLISTS.find((x) => x.key === first.playlist).books.reduce(
            (sum, k) => sum + durations.get(k),
            0,
          )
        : durations.get(first.book);
      contentByDevice.set(d.key, {
        kind: "schedule",
        contentId: scheduleIds.get(src.key),
        title: s.name,
        durationSec,
      });
    }
  }

  const rows = [];
  for (const [deviceKey, content] of contentByDevice) {
    const deviceId = deviceIds.get(deviceKey);
    const rand = mulberry32(deviceId * 7919 + 13);
    for (let day = PLAY_LOG_DAYS; day >= 2; day -= 1) {
      const start = daysAgo(day);
      start.setHours(13, 0, 0, 0); // 오후 피크 블록
      let cursor = start.getTime();
      const blockEnd = cursor + PLAY_LOG_BLOCK_MIN * 60 * 1000;
      while (cursor < blockEnd) {
        // 반복 길이 ±15% + 전환 간격 — 앱의 백필과 같은 방식
        const durationSec = Math.max(
          30,
          Math.round(content.durationSec * (0.85 + rand() * 0.3)),
        );
        if (cursor + durationSec * 1000 > blockEnd) break;
        rows.push({
          deviceId,
          contentKind: content.kind,
          contentId: content.contentId,
          contentTitle: content.title,
          startedAt: new Date(cursor),
          durationSec,
        });
        cursor += durationSec * 1000 + Math.round(rand() * 20) * 1000;
      }
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await sql`INSERT INTO creta_play_log ${sql(rows.slice(i, i + 500))}`;
  }
  return rows.length;
}

// ── 실행 ────────────────────────────────────────────────────────────

async function main() {
  const {
    media: mediaDir,
    uploadRoot,
    ownerEmail,
  } = parseArgs(process.argv.slice(2));
  console.log(`원본 미디어: ${mediaDir}`);
  console.log(`업로드 루트: ${uploadRoot}`);

  console.log("\n[1/3] 미디어 준비");
  const media = await prepareMedia({ mediaDir, uploadRoot });
  for (const [key, item] of media) {
    console.log(`  · ${key.padEnd(10)} ${item.src}`);
  }

  const sql = postgres({
    host: process.env.DB_HOST?.trim() || "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME?.trim() || "reactauth",
    password: process.env.DB_PASSWORD?.trim() || "reactauth",
    database: process.env.DB_NAME?.trim() || "reactauth",
    onnotice: () => {},
  });

  try {
    // --owner-email 로 지정하면 그 계정, 아니면 가장 먼저 만들어진 계정이 소유자가 된다
    const [owner] = ownerEmail
      ? await sql`SELECT id, name, email FROM "user" WHERE lower(email) = ${ownerEmail.toLowerCase()}`
      : await sql`SELECT id, name, email FROM "user" ORDER BY id LIMIT 1`;
    if (!owner) {
      throw new Error(
        ownerEmail
          ? `계정을 찾을 수 없습니다: ${ownerEmail} — 앱에서 먼저 회원가입을 해주세요.`
          : "사용자가 없습니다 — 앱에서 먼저 회원가입을 해주세요.",
      );
    }
    console.log(
      `\n[2/3] 소유자: ${owner.name} <${owner.email}> (id=${owner.id})`,
    );

    const books = buildBooks((key) => {
      const item = media.get(key);
      if (!item) throw new Error(`미디어 키를 찾을 수 없습니다: ${key}`);
      return item;
    });
    const counts = await sql.begin(async (tx) => {
      await clearPreviousSeed(tx, books);

      const { ids: bookIds, durations } = await insertBooks(
        tx,
        books,
        media,
        owner.id,
      );
      const playlistIds = await insertPlaylists(tx, bookIds, owner.id);
      const scheduleIds = await insertSchedules(
        tx,
        bookIds,
        playlistIds,
        owner.id,
      );
      const deviceIds = await insertDevices(tx, {
        bookIds,
        playlistIds,
        scheduleIds,
      });
      await insertWalls(tx, bookIds, deviceIds, owner.id);
      await insertAlerts(tx, deviceIds, owner.id);

      const adSlots = books.flatMap((b) =>
        (b.adSlots ?? []).map((s) => ({
          bookId: bookIds.get(b.key),
          elementId: s.id,
        })),
      );
      const adLogs = await insertAds(tx, media, owner.id, adSlots);
      const playLogs = await insertPlayLogs(tx, {
        books,
        bookIds,
        playlistIds,
        scheduleIds,
        deviceIds,
        durations,
      });

      return { adSlots: adSlots.length, adLogs, playLogs };
    });

    console.log("\n[3/3] 완료");
    console.log(
      `  스튜디오(북)      ${books.length}개 / 슬라이드 ${books.reduce((n, b) => n + b.pages.length, 0)}장`,
    );
    console.log(`  플레이리스트      ${PLAYLISTS.length}개`);
    console.log(
      `  스케줄            ${SCHEDULES.length}개 / 시간대 ${SCHEDULES.reduce((n, s) => n + s.slots.length, 0)}개`,
    );
    console.log(`  디바이스          ${DEVICES.length}대`);
    console.log(`  비디오월          ${WALLS.length}개`);
    console.log(
      `  광고              광고주 ${ADVERTISERS.length} · 캠페인 ${CAMPAIGNS.length} · 소재 ${CREATIVES.length} · 구좌 ${counts.adSlots}`,
    );
    console.log(`  광고 노출 로그    ${counts.adLogs.toLocaleString()}건`);
    console.log(
      `  재생 이력         ${counts.playLogs.toLocaleString()}건 (최근 48시간은 리포트 조회 시 자동 적재)`,
    );
    console.log(`  긴급 알림 이력    ${ALERTS.length}건`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(`\n실패: ${e.message}`);
  process.exitCode = 1;
});
