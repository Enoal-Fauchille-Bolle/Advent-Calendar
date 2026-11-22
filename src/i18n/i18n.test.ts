import { describe, expect, it } from "vitest";
import { isoDate, LANGUAGES, translation } from "./index.ts";

// December 2, 2026 at 23:30 in Paris: still the 2nd there, already the 2nd in UTC too.
const NOW = new Date("2026-12-02T22:30:00Z");

describe("translation", () => {
  it("has English and French, English first", () => {
    expect(LANGUAGES).toEqual(["en", "fr"]);
  });

  it("writes the header date and the unlock time in each language", () => {
    expect(translation("en").shortDate(NOW, "Europe/Paris")).toBe("Wed 2 Dec");
    expect(translation("fr").shortDate(NOW, "Europe/Paris")).toBe(
      "Mer. 2 déc.",
    );
    expect(translation("en").unlocksOn(7, 12, 2026, "09:00")).toBe(
      "on 7 December at 09:00",
    );
    expect(translation("fr").unlocksOn(7, 12, 2026, "09:00")).toBe(
      "le 7 décembre à 09:00",
    );
  });

  it("rounds the wait up to whole minutes", () => {
    expect(translation("en").login.tooMany(61)).toBe(
      "Too many tries. Try again in 2 min.",
    );
    expect(translation("fr").login.tooMany(60)).toBe(
      "Trop d'essais. Réessaie dans 1 min.",
    );
  });

  it("dates by the calendar's time zone", () => {
    expect(isoDate(NOW, "Europe/Paris")).toBe("2026-12-02");
    expect(isoDate(NOW, "Asia/Tokyo")).toBe("2026-12-03");
  });
});
