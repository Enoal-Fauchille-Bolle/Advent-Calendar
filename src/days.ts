import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { imageSizeFromFile } from "image-size/fromFile";
import { z } from "zod";
import type { DoorSize } from "./settings.ts";

/** Media served from a day's folder, by file extension. */
export const MEDIA_TYPES: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

export class DayError extends Error {}

/** A plain file name inside the day's folder: no folder part, no hidden file. */
const fileName = z
  .string()
  .regex(/^[A-Za-z0-9][\w.-]*$/, "expected a file name in the day's folder")
  .refine((name) => !name.includes(".."), "expected a file name");

const textFields = {
  /** The text itself, or */
  text: z.string().min(1).optional(),
  /** a `.txt` file next to `day.json`, handy for long letters. */
  file: fileName.optional(),
};

const blockSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("text"), ...textFields }),
  z.strictObject({ type: z.literal("letter"), ...textFields }),
  z.strictObject({
    type: z.literal("list"),
    title: z.string().min(1).optional(),
    items: z.array(z.string().min(1)).min(1),
  }),
  z.strictObject({
    type: z.literal("voucher"),
    title: z.string().min(1),
    details: z.string().min(1).optional(),
  }),
  z.strictObject({
    type: z.literal("image"),
    file: fileName,
    alt: z.string().optional(),
    caption: z.string().min(1).optional(),
  }),
  z.strictObject({
    type: z.literal("audio"),
    file: fileName,
    caption: z.string().min(1).optional(),
  }),
]);

const daySchema = z.strictObject({
  title: z.string().min(1).optional(),
  /** The notification for this day, in place of the one of `calendar.json`. */
  notification: z.string().min(1).optional(),
  blocks: z.array(blockSchema).min(1),
});

/** A block as the browser receives it: text files read, media turned into URLs. */
export type ShownBlock =
  | { type: "text" | "letter"; text: string }
  | { type: "list"; title: string | null; items: string[] }
  | { type: "voucher"; title: string; details: string | null }
  | { type: "image"; url: string; alt: string; caption: string | null }
  | { type: "audio"; url: string; caption: string | null };

export interface ShownDay {
  day: number;
  title: string | null;
  blocks: ShownBlock[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The folder of one day: `<content>/days/07`. */
export function dayFolder(contentDir: string, day: number): string {
  return join(contentDir, "days", pad(day));
}

function mediaKind(file: string): "image" | "audio" | undefined {
  const type = MEDIA_TYPES[extname(file).toLowerCase()];
  if (type === undefined) return undefined;
  return type.startsWith("image/") ? "image" : "audio";
}

function mediaUrl(day: number, file: string): string {
  return `/media/${String(day)}/${encodeURIComponent(file)}`;
}

type DayData = z.infer<typeof daySchema>;

/**
 * Reads and checks a day's `day.json`, or returns `null` when the day has no folder
 * yet. A malformed file throws `DayError`.
 */
function readDayFile(
  contentDir: string,
  day: number,
): { folder: string; path: string; data: DayData } | null {
  const folder = dayFolder(contentDir, day);
  const path = join(folder, "day.json");
  if (!existsSync(path)) return null;

  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DayError(`Cannot read ${path}: ${reason}`);
  }
  const result = daySchema.safeParse(data);
  if (!result.success) {
    throw new DayError(`Invalid ${path}:\n${z.prettifyError(result.error)}`);
  }
  return { folder, path, data: result.data };
}

/**
 * Reads a day's `day.json`, or returns `null` when the day has no folder yet.
 * A malformed day throws `DayError`.
 */
export function loadDay(contentDir: string, day: number): ShownDay | null {
  const file = readDayFile(contentDir, day);
  if (file === null) return null;
  const { folder, path, data } = file;

  const fail = (index: number, message: string): never => {
    throw new DayError(
      `Invalid ${path}: block ${String(index + 1)}: ${message}`,
    );
  };
  const existing = (index: number, file: string): string => {
    const filePath = join(folder, file);
    if (!existsSync(filePath)) fail(index, `${file} does not exist`);
    return filePath;
  };

  const blocks = data.blocks.map((block, index): ShownBlock => {
    switch (block.type) {
      case "text":
      case "letter": {
        if ((block.text === undefined) === (block.file === undefined)) {
          return fail(index, 'give either "text" or "file"');
        }
        const text =
          block.text ?? readFileSync(existing(index, block.file ?? ""), "utf8");
        return { type: block.type, text: text.trim() };
      }
      case "list":
        return { type: "list", title: block.title ?? null, items: block.items };
      case "voucher":
        return {
          type: "voucher",
          title: block.title,
          details: block.details ?? null,
        };
      case "image":
      case "audio": {
        if (mediaKind(block.file) !== block.type) {
          return fail(
            index,
            `${block.file} is not a supported ${block.type} file`,
          );
        }
        existing(index, block.file);
        const url = mediaUrl(day, block.file);
        const caption = block.caption ?? null;
        return block.type === "image"
          ? { type: "image", url, alt: block.alt ?? "", caption }
          : { type: "audio", url, caption };
      }
    }
  });

  return { day, title: data.title ?? null, blocks };
}

/**
 * The `notification` of a day's `day.json`, or `null` when it has none or has no
 * folder yet. A malformed day throws `DayError`.
 */
export function dayNotification(
  contentDir: string,
  day: number,
): string | null {
  return readDayFile(contentDir, day)?.data.notification ?? null;
}

/** Width over height above which a photo is landscape; its inverse marks portrait. */
const LANDSCAPE_RATIO = 1.25;

/** Tile size by the type of a day's first block; photos go by their shape instead. */
const SIZE_BY_TYPE: Readonly<
  Record<DayData["blocks"][number]["type"], DoorSize>
> = {
  text: "small",
  letter: "tall",
  list: "tall",
  voucher: "small",
  image: "big",
  audio: "small",
};

/** Photo shapes already measured, by path, size and change time. */
const shapes = new Map<string, DoorSize>();

/** Wide, tall or big for a photo, by its shape as it shows on screen. */
async function photoSize(path: string): Promise<DoorSize> {
  const stats = statSync(path);
  const key = `${path}|${String(stats.size)}|${String(stats.mtimeMs)}`;
  const known = shapes.get(key);
  if (known !== undefined) return known;
  const { width, height, orientation } = await imageSizeFromFile(path);
  // EXIF orientations 5 to 8 turn the picture a quarter: the stored sides swap.
  const turned = orientation !== undefined && orientation >= 5;
  const ratio = turned ? height / width : width / height;
  const size: DoorSize =
    ratio >= LANDSCAPE_RATIO
      ? "wide"
      : ratio <= 1 / LANDSCAPE_RATIO
        ? "tall"
        : "big";
  shapes.set(key, size);
  return size;
}

/**
 * The tile size a door takes from its content: by the type of its first block, or
 * for a photo by its shape. A day with no folder, a broken day or an unreadable photo
 * gets a small tile; opening it reports the problem.
 */
export async function doorSize(
  contentDir: string,
  day: number,
): Promise<DoorSize> {
  try {
    const file = readDayFile(contentDir, day);
    const first = file?.data.blocks[0];
    if (file === null || first === undefined) return "small";
    if (first.type !== "image") return SIZE_BY_TYPE[first.type];
    if (mediaKind(first.file) !== "image") return "small";
    return await photoSize(join(file.folder, first.file));
  } catch {
    return "small";
  }
}

/**
 * The path and media type of a file in a day's folder, or `null` when the name is not
 * a plain media file name or the file does not exist.
 */
export function findMedia(
  contentDir: string,
  day: number,
  file: string,
): { path: string; type: string; size: number } | null {
  if (!fileName.safeParse(file).success) return null;
  const type = MEDIA_TYPES[extname(file).toLowerCase()];
  if (type === undefined) return null;
  const path = join(dayFolder(contentDir, day), file);
  if (!existsSync(path)) return null;
  const stats = statSync(path);
  return stats.isFile() ? { path, type, size: stats.size } : null;
}
