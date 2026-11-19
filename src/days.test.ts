import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DayError,
  dayNotification,
  doorSize,
  findMedia,
  loadDay,
} from "./days.ts";

const EXAMPLES = "examples/content";

/** A content folder holding one day with the given `day.json` and extra files. */
function contentWith(
  day: unknown,
  files: Record<string, string | Uint8Array> = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "advent-days-"));
  const folder = join(root, "days", "04");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "day.json"), JSON.stringify(day));
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(folder, name), text);
  }
  return root;
}

describe("loadDay", () => {
  it("reads a letter from its text file", () => {
    const day = loadDay(EXAMPLES, 1);
    expect(day?.title).toBe("Une petite lettre");
    expect(day?.blocks[0]).toMatchObject({ type: "letter" });
    expect(day?.blocks[0]).toHaveProperty(
      "text",
      expect.stringContaining("exemple de lettre"),
    );
  });

  it("turns media into URLs", () => {
    expect(loadDay(EXAMPLES, 3)?.blocks[1]).toEqual({
      type: "image",
      url: "/media/3/photo.png",
      alt: "Un carré rouge",
      caption: "La légende de la photo",
    });
  });

  it("returns null for a day with no folder", () => {
    expect(loadDay(EXAMPLES, 24)).toBeNull();
  });

  it.each([
    ["no blocks", { blocks: [] }],
    [
      "both text and file",
      { blocks: [{ type: "text", text: "a", file: "a.txt" }] },
    ],
    ["neither text nor file", { blocks: [{ type: "letter" }] }],
    ["a missing text file", { blocks: [{ type: "letter", file: "nope.txt" }] }],
    [
      "a path in a file name",
      { blocks: [{ type: "image", file: "../secret.png" }] },
    ],
    ["a sound as an image", { blocks: [{ type: "image", file: "voice.mp3" }] }],
    ["an unknown block type", { blocks: [{ type: "video", file: "a.mp4" }] }],
  ])("refuses %s", (_, day) => {
    expect(() => loadDay(contentWith(day, { "voice.mp3": "x" }), 4)).toThrow(
      DayError,
    );
  });
});

describe("findMedia", () => {
  it("finds a media file of the day", () => {
    expect(findMedia(EXAMPLES, 3, "photo.png")).toMatchObject({
      type: "image/png",
    });
  });

  it.each(["../01/letter.txt", "letter.txt", ".hidden.png", "missing.png"])(
    "refuses %s",
    (name) => {
      expect(findMedia(EXAMPLES, 1, name)).toBeNull();
    },
  );
});

/** The start of a PNG file, enough for its width and height to be read. */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

const photoDay = (file: string) => ({ blocks: [{ type: "image", file }] });

describe("doorSize", () => {
  it.each([
    ["a letter", 1, "tall"],
    ["a voucher before a list", 2, "small"],
    ["a text before a square photo", 3, "small"],
    ["a day with no folder", 24, "small"],
  ])("sizes %s", async (_, day, size) => {
    expect(await doorSize(EXAMPLES, day)).toBe(size);
  });

  it.each([
    ["a landscape photo", 400, 300, "wide"],
    ["a portrait photo", 300, 400, "tall"],
    ["a square photo", 300, 300, "big"],
    ["a nearly square photo", 320, 300, "big"],
  ])("sizes %s by its shape", async (_, width, height, size) => {
    const root = contentWith(photoDay("photo.png"), {
      "photo.png": pngHeader(width, height),
    });
    expect(await doorSize(root, 4)).toBe(size);
  });

  it.each([
    ["a list", { blocks: [{ type: "list", items: ["a"] }] }, "tall"],
    ["a sound", { blocks: [{ type: "audio", file: "voice.mp3" }] }, "small"],
    ["a broken day", { blocks: [] }, "small"],
    ["a missing photo", photoDay("missing.png"), "small"],
    ["a photo that is not one", photoDay("fake.png"), "small"],
  ])("sizes %s", async (_, day, size) => {
    const root = contentWith(day, { "voice.mp3": "x", "fake.png": "text" });
    expect(await doorSize(root, 4)).toBe(size);
  });
});

describe("dayNotification", () => {
  it("reads a day's own notification", () => {
    const content = contentWith({
      notification: "Prends ton écharpe",
      blocks: [{ type: "text", text: "x" }],
    });
    expect(dayNotification(content, 4)).toBe("Prends ton écharpe");
  });

  it("returns null for a day without one or with no folder", () => {
    const content = contentWith({ blocks: [{ type: "text", text: "x" }] });
    expect(dayNotification(content, 4)).toBeNull();
    expect(dayNotification(content, 5)).toBeNull();
  });

  it("refuses an empty notification", () => {
    const content = contentWith({
      notification: "",
      blocks: [{ type: "text", text: "x" }],
    });
    expect(() => dayNotification(content, 4)).toThrow(DayError);
  });
});
