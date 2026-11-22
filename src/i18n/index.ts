import { en } from "./en.ts";
import { fr } from "./fr.ts";
import type { Strings } from "./types.ts";

export type { Strings } from "./types.ts";

/**
 * The interface languages, chosen with `language` in `calendar.json`. Another one is a
 * new file next to `en.ts` that implements `Strings`, added here.
 */
const TRANSLATIONS = { en, fr } as const satisfies Record<string, Strings>;

export type Language = keyof typeof TRANSLATIONS;
export const LANGUAGES = Object.keys(TRANSLATIONS) as [Language, ...Language[]];
export const DEFAULT_LANGUAGE: Language = "en";

/** Every text of the interface in one language. */
export function translation(language: Language): Strings {
  return TRANSLATIONS[language];
}

/** "2026-12-02": today's date in the calendar's time zone, for `datetime` attributes. */
export function isoDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}
