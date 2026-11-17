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
    sizes: z
      .record(
        z.string().regex(/^[1-9]\d?$/, "expected a door number, such as 5"),
        z.enum(DOOR_SIZES),
      )
      .default({}),
  })
  .refine((s) => s.firstDay <= s.lastDay, {
    message: "firstDay must not come after lastDay",
    path: ["lastDay"],
  })
  .refine((s) => s.lastDay <= daysInMonth(s.year, s.month), {
    message: "lastDay is past the end of the month",
    path: ["lastDay"],
  })
  .refine(
    (s) =>
      Object.keys(s.sizes).every(
        (day) => Number(day) >= s.firstDay && Number(day) <= s.lastDay,
      ),
    {
      message: "a door in sizes is outside firstDay to lastDay",
      path: ["sizes"],
    },
  );

export type Settings = z.infer<typeof settingsSchema>;

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
