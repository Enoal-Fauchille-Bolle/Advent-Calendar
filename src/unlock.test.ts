import { describe, expect, it } from "vitest";
import { parseSettings } from "./settings.ts";
import { calendarDays, isUnlocked, localDateTime } from "./unlock.ts";

const settings = parseSettings({
  title: "Test",
  year: 2026,
  month: 12,
  firstDay: 1,
  lastDay: 25,
  timezone: "Europe/Paris",
  unlockTime: "09:00",
});

describe("localDateTime", () => {
  it("gives the wall-clock time of the zone", () => {
    // Paris is UTC+1 in December, UTC+2 in summer.
    expect(
      localDateTime(new Date("2026-12-07T08:00:00Z"), "Europe/Paris"),
    ).toBe("2026-12-07T09:00");
    expect(
      localDateTime(new Date("2026-07-01T22:30:00Z"), "Europe/Paris"),
    ).toBe("2026-07-02T00:30");
  });
});

describe("isUnlocked", () => {
  it("opens door N on day N at the unlock time, local time", () => {
    expect(isUnlocked(7, settings, new Date("2026-12-07T07:59:00Z"))).toBe(
      false,
    );
    expect(isUnlocked(7, settings, new Date("2026-12-07T08:00:00Z"))).toBe(
      true,
    );
  });

  it("keeps later doors shut and earlier doors open", () => {
    const now = new Date("2026-12-07T12:00:00Z");
    expect(isUnlocked(6, settings, now)).toBe(true);
    expect(isUnlocked(8, settings, now)).toBe(false);
  });

  it("keeps every door shut before the month and open after it", () => {
    expect(isUnlocked(1, settings, new Date("2026-11-30T23:00:00Z"))).toBe(
      false,
    );
    expect(isUnlocked(25, settings, new Date("2027-01-15T12:00:00Z"))).toBe(
      true,
    );
  });

  it("refuses door numbers outside the range", () => {
    const later = new Date("2027-01-15T12:00:00Z");
    expect(isUnlocked(0, settings, later)).toBe(false);
    expect(isUnlocked(26, settings, later)).toBe(false);
    expect(isUnlocked(2.5, settings, later)).toBe(false);
  });

  it("follows another time zone and unlock time", () => {
    const tokyo = parseSettings({
      ...settings,
      timezone: "Asia/Tokyo",
      unlockTime: "21:30",
    });
    // 21:30 in Tokyo (UTC+9) is 12:30 UTC.
    expect(isUnlocked(3, tokyo, new Date("2026-12-03T12:29:00Z"))).toBe(false);
    expect(isUnlocked(3, tokyo, new Date("2026-12-03T12:30:00Z"))).toBe(true);
  });
});

describe("calendarDays", () => {
  it("lists every door from the first to the last day", () => {
    expect(calendarDays(settings)).toHaveLength(25);
    expect(calendarDays({ ...settings, firstDay: 20, lastDay: 24 })).toEqual([
      20, 21, 22, 23, 24,
    ]);
  });
});
