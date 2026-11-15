import { describe, expect, it } from "vitest";
import { parseSettings, readSettings, SettingsError } from "./settings.ts";

const valid = {
  title: "Test",
  year: 2026,
  month: 12,
  firstDay: 1,
  lastDay: 25,
  timezone: "Europe/Paris",
  unlockTime: "09:00",
};

describe("parseSettings", () => {
  it("accepts valid settings and defaults the banner to empty", () => {
    expect(parseSettings(valid)).toEqual({ ...valid, banner: "" });
  });

  it.each([
    ["an unknown time zone", { timezone: "Europe/Atlantis" }],
    ["a time without leading zero", { unlockTime: "9:00" }],
    ["an hour past 23", { unlockTime: "24:00" }],
    ["a first day after the last", { firstDay: 10, lastDay: 5 }],
    ["a last day past the month", { month: 11, lastDay: 31 }],
    ["an unknown key", { colour: "red" }],
    ["a fractional day", { firstDay: 1.5 }],
  ])("refuses %s", (_, change) => {
    expect(() => parseSettings({ ...valid, ...change })).toThrow(SettingsError);
  });
});

describe("readSettings", () => {
  it("reads the example content", () => {
    expect(readSettings("examples/content").lastDay).toBe(25);
  });

  it("explains a missing file", () => {
    expect(() => readSettings("does-not-exist")).toThrow(/Cannot read/);
  });
});
