import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/** The settings file, at the root of the content folder. */
export const SETTINGS_FILE = "calendar.json";

export class SettingsError extends Error {}

/**
 * Tile sizes in the door grid: small is one column and one row, tall two rows, wide
 * two columns, big two of each.
 */
export const DOOR_SIZES = ["small", "tall", "wide", "big"] as const;
export type DoorSize = (typeof DOOR_SIZES)[number];

/**
 * How a door opens the first time: it swings on a hinge, opens as a double door,
 * tears like wrapping paper, lifts like a box lid, fades, or shows its day at once.
 */
export const DOOR_ANIMATIONS = [
  "swing",
  "double",
  "tear",
  "lid",
  "fade",
  "none",
] as const;
export type DoorAnimation = (typeof DOOR_ANIMATIONS)[number];

/** The animations a door gets when the settings choose none for it. */
const DEFAULT_ANIMATIONS: readonly DoorAnimation[] = [
  "swing",
  "double",
  "tear",
  "lid",
  "fade",
];

const doorNumber = z
  .string()
  .regex(/^[1-9]\d?$/, "expected a door number, such as 5");

function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Whether every door number of a by-door map lies between firstDay and lastDay. */
function inRange(
  s: { firstDay: number; lastDay: number },
  byDoor: Record<string, unknown>,
): boolean {
  return Object.keys(byDoor).every(
    (day) => Number(day) >= s.firstDay && Number(day) <= s.lastDay,
  );
}

const settingsSchema = z
  .strictObject({
    title: z.string().min(1),
    /** Scrolling text at the top of the page; empty hides the banner. */
    banner: z.string().default(""),
    year: z.int().min(2000).max(9999),
    month: z.int().min(1).max(12),
    firstDay: z.int().min(1).max(31),
    lastDay: z.int().min(1).max(31),
    /** IANA name, such as `Europe/Paris`. */
    timezone: z.string().refine(isTimeZone, "unknown time zone"),
    /** Local time at which each door opens, `HH:MM` on 24 hours. */
    unlockTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM, such as 09:00"),
    /** Door sizes chosen by hand, by door number; other doors take theirs from the content. */
    sizes: z.record(doorNumber, z.enum(DOOR_SIZES)).default({}),
    /** Opening animations chosen by hand, by door number; see `doorAnimation`. */
    animations: z.record(doorNumber, z.enum(DOOR_ANIMATIONS)).default({}),
  })
  .refine((s) => s.firstDay <= s.lastDay, {
    message: "firstDay must not come after lastDay",
    path: ["lastDay"],
  })
  .refine((s) => s.lastDay <= daysInMonth(s.year, s.month), {
    message: "lastDay is past the end of the month",
    path: ["lastDay"],
  })
  .refine((s) => inRange(s, s.sizes), {
    message: "a door in sizes is outside firstDay to lastDay",
    path: ["sizes"],
  })
  .refine((s) => inRange(s, s.animations), {
    message: "a door in animations is outside firstDay to lastDay",
    path: ["animations"],
  });

export type Settings = z.infer<typeof settingsSchema>;

/**
 * How a door opens: the one the settings give it, or else one of the five animations,
 * picked from its number so that two days in a row never share one.
 */
export function doorAnimation(settings: Settings, day: number): DoorAnimation {
  return (
    settings.animations[String(day)] ??
    DEFAULT_ANIMATIONS[(day * 2) % DEFAULT_ANIMATIONS.length] ??
    "fade"
  );
}

export function parseSettings(data: unknown): Settings {
  const result = settingsSchema.safeParse(data);
  if (!result.success) {
    throw new SettingsError(
      `Invalid ${SETTINGS_FILE}:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

/** Reads and checks the settings file of a content folder. */
export function readSettings(contentDir: string): Settings {
  const path = join(contentDir, SETTINGS_FILE);
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SettingsError(`Cannot read ${path}: ${reason}`);
  }
  return parseSettings(data);
}
