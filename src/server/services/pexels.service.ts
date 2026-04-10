// Pexels API: 사진·동영상 검색 URL 반환
type PexelsSearchJson = {
  photos?: {
    width: number;
    height: number;
    src?: { large?: string; large2x?: string; original?: string };
  }[];
};

type PexelsVideoFile = {
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
};

type PexelsVideoItem = {
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files?: PexelsVideoFile[];
};

type PexelsVideoSearchJson = {
  videos?: PexelsVideoItem[];
};

/**
 * https://www.pexels.com/api/ — 헤더는 `Authorization: <API_KEY>` (Bearer 아님).
 */
export class PexelsService {
  async searchFirstPhoto(
    query: string,
  ): Promise<{ url: string; width: number; height: number } | null> {
    const key = process.env.PEXELS_API_KEY?.trim();
    if (!key) return null;
    const q = query.trim().slice(0, 200);
    if (!q) return null;

    const pickFirst = (
      data: PexelsSearchJson,
    ): { url: string; width: number; height: number } | null => {
      const p = data.photos?.[0];
      const src = p?.src?.large2x ?? p?.src?.large ?? p?.src?.original;
      if (!p || !src) return null;
      return {
        url: src,
        width: Math.max(1, p.width),
        height: Math.max(1, p.height),
      };
    };

    const search = async (orientation: "landscape" | undefined) => {
      const o = orientation ? `&orientation=${orientation}` : "";
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15${o}`;
      const res = await fetch(url, {
        headers: { Authorization: key },
      });
      if (!res.ok) return null;
      return (await res.json()) as PexelsSearchJson;
    };

    try {
      let data = await search("landscape");
      let hit = data ? pickFirst(data) : null;
      if (!hit) {
        data = await search(undefined);
        hit = data ? pickFirst(data) : null;
      }
      return hit;
    } catch {
      return null;
    }
  }

  async searchFirstVideo(query: string): Promise<{
    videoUrl: string;
    posterUrl: string;
    width: number;
    height: number;
    duration: number;
  } | null> {
    const key = process.env.PEXELS_API_KEY?.trim();
    if (!key) return null;
    const q = query.trim().slice(0, 200);
    if (!q) return null;

    const isHttps = (f: PexelsVideoFile) =>
      typeof f.link === "string" && /^https:\/\//i.test(f.link);

    const pickSmallest = (
      files: PexelsVideoFile[],
      pred: (f: PexelsVideoFile) => boolean,
    ): PexelsVideoFile | null => {
      const cands = files.filter((f) => isHttps(f) && pred(f));
      if (!cands.length) return null;
      cands.sort((a, b) => a.width - b.width || a.height - b.height);
      return cands[0] ?? null;
    };

    const looksMp4 = (f: PexelsVideoFile) => {
      const ft = String(f.file_type ?? "").toLowerCase();
      return ft.includes("mp4") || /\.mp4(\?|$)/i.test(f.link);
    };
    const looksWebm = (f: PexelsVideoFile) => {
      const ft = String(f.file_type ?? "").toLowerCase();
      return ft.includes("webm") || /\.webm(\?|$)/i.test(f.link);
    };
    const looksOtherProgressiveVideo = (f: PexelsVideoFile) => {
      const ft = String(f.file_type ?? "").toLowerCase();
      if (/\.m3u8(\?|$)/i.test(f.link)) return false;
      if (ft.includes("mpegurl") || ft.includes("hls")) return false;
      if (/\.mov(\?|$)/i.test(f.link)) return true;
      return ft.startsWith("video/");
    };

    const pickPlayableFile = (v: PexelsVideoItem): PexelsVideoFile | null => {
      const files = v.video_files ?? [];
      return (
        pickSmallest(files, looksMp4) ??
        pickSmallest(files, looksWebm) ??
        pickSmallest(files, looksOtherProgressiveVideo)
      );
    };

    const pickFromResponse = (
      data: PexelsVideoSearchJson | null,
      maxDurationSec: number,
    ): {
      videoUrl: string;
      posterUrl: string;
      width: number;
      height: number;
      duration: number;
    } | null => {
      const list = [...(data?.videos ?? [])].sort(
        (a, b) =>
          (typeof a.duration === "number" ? a.duration : 999) -
          (typeof b.duration === "number" ? b.duration : 999),
      );
      for (const v of list) {
        const dur =
          typeof v.duration === "number" && Number.isFinite(v.duration)
            ? v.duration
            : 0;
        if (dur > maxDurationSec) continue;
        const f = pickPlayableFile(v);
        if (!f || typeof v.image !== "string" || !v.image.trim()) continue;
        return {
          videoUrl: f.link,
          posterUrl: v.image.trim(),
          width: Math.max(1, f.width),
          height: Math.max(1, f.height),
          duration: Math.max(1, Math.round(dur)),
        };
      }
      return null;
    };

    const fetchSearch = async (
      orientation: "landscape" | undefined,
      maxDuration: number | undefined,
    ) => {
      const o = orientation ? `&orientation=${orientation}` : "";
      const md = maxDuration != null ? `&max_duration=${maxDuration}` : "";
      const url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(q)}&per_page=20${md}${o}`;
      const res = await fetch(url, { headers: { Authorization: key } });
      if (!res.ok) return null;
      return (await res.json()) as PexelsVideoSearchJson;
    };

    try {
      const attempts: {
        orientation: "landscape" | undefined;
        maxDuration: number | undefined;
        pickMax: number;
      }[] = [
        { orientation: "landscape", maxDuration: 25, pickMax: 25 },
        { orientation: undefined, maxDuration: 25, pickMax: 25 },
        { orientation: "landscape", maxDuration: undefined, pickMax: 35 },
        { orientation: undefined, maxDuration: undefined, pickMax: 35 },
      ];

      for (const att of attempts) {
        const data = await fetchSearch(att.orientation, att.maxDuration);
        const hit = pickFromResponse(data, att.pickMax);
        if (hit) return hit;
      }
      return null;
    } catch {
      return null;
    }
  }
}
