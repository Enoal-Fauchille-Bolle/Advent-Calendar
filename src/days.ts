import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { z } from "zod";

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

/**
 * Reads a day's `day.json`, or returns `null` when the day has no folder yet.
 * A malformed day throws `DayError`.
 */
export function loadDay(contentDir: string, day: number): ShownDay | null {
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

  const blocks = result.data.blocks.map((block, index): ShownBlock => {
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

  return { day, title: result.data.title ?? null, blocks };
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
