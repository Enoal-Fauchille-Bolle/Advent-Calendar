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
  it("accepts valid settings and defaults the banner and sizes to empty", () => {
    expect(parseSettings(valid)).toEqual({ ...valid, banner: "", sizes: {} });
  });

  it("accepts door sizes chosen by hand", () => {
    const sizes = { "1": "big", "25": "wide" };
    expect(parseSettings({ ...valid, sizes }).sizes).toEqual(sizes);
  });

  it.each([
    ["an unknown time zone", { timezone: "Europe/Atlantis" }],
    ["a time without leading zero", { unlockTime: "9:00" }],
    ["an hour past 23", { unlockTime: "24:00" }],
    ["a first day after the last", { firstDay: 10, lastDay: 5 }],
    ["a last day past the month", { month: 11, lastDay: 31 }],
    ["an unknown key", { colour: "red" }],
    ["a fractional day", { firstDay: 1.5 }],
    ["an unknown door size", { sizes: { "1": "huge" } }],
    ["a size for a door out of range", { sizes: { "26": "big" } }],
    ["a door number with a leading zero", { sizes: { "05": "big" } }],
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
