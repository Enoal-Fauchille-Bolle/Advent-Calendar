import { describe, expect, it } from "vitest";
import {
  doorAnimation,
  parseSettings,
  readSettings,
  SettingsError,
} from "./settings.ts";

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
  it("accepts valid settings and defaults the language, banner, sizes and animations", () => {
    expect(parseSettings(valid)).toEqual({
      ...valid,
      language: "en",
      banner: "",
      bannerSpeed: 10,
      sizes: {},
      animations: {},
    });
  });

  it("accepts a known language and refuses any other", () => {
    expect(parseSettings({ ...valid, language: "fr" }).language).toBe("fr");
    expect(() => parseSettings({ ...valid, language: "de" })).toThrow(
      SettingsError,
    );
  });

  it("accepts a notification sentence and refuses an empty one", () => {
    expect(
      parseSettings({ ...valid, notification: "Door {day}" }).notification,
    ).toBe("Door {day}");
    expect(() => parseSettings({ ...valid, notification: "" })).toThrow(
      SettingsError,
    );
  });

  it("accepts door sizes chosen by hand", () => {
    const sizes = { "1": "big", "25": "wide" };
    expect(parseSettings({ ...valid, sizes }).sizes).toEqual(sizes);
  });

  it("accepts door animations chosen by hand, none included", () => {
    const animations = { "3": "tear", "25": "none" };
    expect(parseSettings({ ...valid, animations }).animations).toEqual(
      animations,
    );
  });

  it.each([
    ["an unknown time zone", { timezone: "Europe/Atlantis" }],
    ["a time without leading zero", { unlockTime: "9:00" }],
    ["an hour past 23", { unlockTime: "24:00" }],
    ["a first day after the last", { firstDay: 10, lastDay: 5 }],
    ["a last day past the month", { month: 11, lastDay: 31 }],
    ["an unknown key", { colour: "red" }],
    ["a banner speed of zero", { bannerSpeed: 0 }],
    ["a negative banner speed", { bannerSpeed: -5 }],
    ["a fractional day", { firstDay: 1.5 }],
    ["an unknown door size", { sizes: { "1": "huge" } }],
    ["a size for a door out of range", { sizes: { "26": "big" } }],
    ["a door number with a leading zero", { sizes: { "05": "big" } }],
    ["an unknown animation", { animations: { "1": "explode" } }],
    ["an animation for a door out of range", { animations: { "26": "fade" } }],
  ])("refuses %s", (_, change) => {
    expect(() => parseSettings({ ...valid, ...change })).toThrow(SettingsError);
  });
});

describe("doorAnimation", () => {
  it("uses the animation the settings give a door", () => {
    const settings = parseSettings({ ...valid, animations: { "4": "none" } });
    expect(doorAnimation(settings, 4)).toBe("none");
  });

  it("gives the other doors one of five, never the same two days in a row", () => {
    const settings = parseSettings(valid);
    const picked = Array.from({ length: 25 }, (_, i) =>
      doorAnimation(settings, i + 1),
    );
    expect(new Set(picked)).toEqual(
      new Set(["swing", "double", "tear", "lid", "fade"]),
    );
    for (let i = 1; i < picked.length; i++) {
      expect(picked[i]).not.toBe(picked[i - 1]);
    }
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
