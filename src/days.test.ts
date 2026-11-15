import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DayError, findMedia, loadDay } from "./days.ts";

const EXAMPLES = "examples/content";

/** A content folder holding one day with the given `day.json` and extra files. */
function contentWith(day: unknown, files: Record<string, string> = {}): string {
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
