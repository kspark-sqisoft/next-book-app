// 디바이스 예시 로그 — 결정적·시간순·전원 예약 반영·날짜별 변화
import { describe, expect, it } from "vitest";

import {
  buildDeviceSampleLog,
  deviceLogDateKey,
  recentDeviceLogDateKeys,
} from "@/lib/device-sample-log";

describe("buildDeviceSampleLog", () => {
  it("같은 디바이스·같은 날이면 같은 로그(결정적), 시간순 정렬", () => {
    const a = buildDeviceSampleLog({
      deviceId: 3,
      online: true,
      date: "2026-08-24",
    });
    const b = buildDeviceSampleLog({
      deviceId: 3,
      online: true,
      date: "2026-08-24",
    });
    expect(a).toEqual(b);
    const times = a.map((e) => e.time);
    expect([...times].sort()).toEqual(times);
    expect(a.length).toBeGreaterThanOrEqual(7);
  });
  it("다른 디바이스·다른 날은 다른 로그", () => {
    const a = buildDeviceSampleLog({
      deviceId: 1,
      online: true,
      date: "2026-08-24",
    });
    const b = buildDeviceSampleLog({
      deviceId: 2,
      online: true,
      date: "2026-08-24",
    });
    const c = buildDeviceSampleLog({
      deviceId: 1,
      online: true,
      date: "2026-08-23",
    });
    expect(a.map((e) => e.time)).not.toEqual(b.map((e) => e.time));
    expect(a.map((e) => e.time)).not.toEqual(c.map((e) => e.time));
  });
  it("전원 예약 시각이 기동·종료 로그에 반영된다", () => {
    const log = buildDeviceSampleLog({
      deviceId: 5,
      online: true,
      powerOnTime: "07:30",
      powerOffTime: "22:00",
      sourceTitle: "로비 웰컴 루프",
      date: "2026-08-24",
    });
    const boot = log.find((e) => e.event === "BOOT")!;
    const off = log.find((e) => e.event === "SHUTDOWN")!;
    expect(boot.time.startsWith("07:30")).toBe(true);
    expect(boot.message).toContain("정상 기동 시작");
    expect(off.time.startsWith("22:00")).toBe(true);
    expect(log.find((e) => e.event === "SOURCE_LOAD")!.message).toContain(
      "로비 웰컴 루프",
    );
  });
  it("최근 7일 안에는 정상·경고·이상이 모두 등장하고, 문제 없는 날도 있다", () => {
    const days = recentDeviceLogDateKeys(7, new Date(2026, 7, 24));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-08-24");
    expect(days[6]).toBe("2026-08-18");
    const levels = new Set<string>();
    let cleanDays = 0;
    for (const date of days) {
      const log = buildDeviceSampleLog({ deviceId: 9, online: true, date });
      for (const e of log) levels.add(e.level);
      if (!log.some((e) => e.level === "error")) cleanDays += 1;
    }
    expect(levels.has("info")).toBe(true);
    expect(levels.has("warn")).toBe(true);
    expect(levels.has("error")).toBe(true);
    expect(cleanDays).toBeGreaterThan(0);
  });
  it("날짜 키는 로컬 기준 YYYY-MM-DD", () => {
    expect(deviceLogDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
