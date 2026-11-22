// Draws the generated pictures and synthesises the melodies of examples/content/.
// The photos are not made here: examples/CREDITS.md lists where they come from.
//
// Run from the repository root: node examples/tools/make-media.ts
// Needs ffmpeg built with librsvg (SVG to JPEG), libmp3lame and libopus.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DAYS = "examples/content/days";

// The calendar's palette, from assets/style.css.
const WINE = "#7a1f3d";
const CREAM = "#fbf6ee";
const PINK = "#f2c4cf";
const SERIF = "Fraunces, Georgia, 'DejaVu Serif', serif";
const SANS = "Nunito, 'DejaVu Sans', sans-serif";

const work = mkdtempSync(join(tmpdir(), "advent-media-"));

function ffmpeg(...args: string[]): void {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

/** Renders an SVG drawing to a JPEG in a day's folder. */
function picture(day: string, name: string, svg: string): void {
  const source = join(work, `${name}.svg`);
  writeFileSync(source, svg);
  ffmpeg(
    "-i",
    source,
    "-q:v",
    "4",
    "-map_metadata",
    "-1",
    join(DAYS, day, name),
  );
}

/** A card that shows its own shape: its ratio, its size in pixels and the door it makes. */
function shapeCard(width: number, height: number, ratio: string, door: string) {
  const pad = 36;
  const size = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}">
  <defs>
    <pattern id="gingham" width="48" height="48" patternUnits="userSpaceOnUse">
      <rect width="48" height="48" fill="${CREAM}"/>
      <rect width="24" height="48" fill="${PINK}" opacity="0.55"/>
      <rect width="48" height="24" fill="${PINK}" opacity="0.55"/>
    </pattern>
    <marker id="tip" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0 0 10 5 0 10z" fill="${WINE}"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="url(#gingham)"/>
  <rect x="${String(pad)}" y="${String(pad)}" width="${String(width - 2 * pad)}" height="${String(height - 2 * pad)}"
    rx="28" fill="${CREAM}" stroke="${WINE}" stroke-width="6" stroke-dasharray="20 12"/>
  <line x1="${String(pad + 30)}" y1="${String(pad + 34)}" x2="${String(width - pad - 30)}" y2="${String(pad + 34)}"
    stroke="${WINE}" stroke-width="3" marker-start="url(#tip)" marker-end="url(#tip)"/>
  <text x="${String(cx)}" y="${String(pad + 70)}" text-anchor="middle" font-family="${SANS}" font-size="22" fill="${WINE}">${String(width)} px</text>
  <line x1="${String(pad + 34)}" y1="${String(pad + 60)}" x2="${String(pad + 34)}" y2="${String(height - pad - 30)}"
    stroke="${WINE}" stroke-width="3" marker-start="url(#tip)" marker-end="url(#tip)"/>
  <text transform="translate(${String(pad + 62)} ${String(cy + 20)}) rotate(-90)" text-anchor="middle" font-family="${SANS}" font-size="22" fill="${WINE}">${String(height)} px</text>
  <text x="${String(cx + 16)}" y="${String(cy + size * 0.06)}" text-anchor="middle" font-family="${SERIF}" font-weight="700"
    font-size="${String(Math.round(size * 0.2))}" fill="${WINE}">${ratio}</text>
  <text x="${String(cx + 16)}" y="${String(cy + size * 0.18)}" text-anchor="middle" font-family="${SANS}"
    font-size="${String(Math.round(size * 0.065))}" fill="${WINE}">makes a ${door} door</text>
</svg>`;
}

/** A small random generator with a fixed seed, so each run draws the same snow. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

/** A snowman under falling snow, at night. */
function snowman(width: number, height: number): string {
  const random = seeded(25);
  const flakes = Array.from({ length: 90 }, () => {
    const r = 1.5 + random() * 3.5;
    return `<circle cx="${(random() * width).toFixed(1)}" cy="${(random() * height * 0.8).toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.5 + random() * 0.5).toFixed(2)}"/>`;
  }).join("\n  ");
  const x = width / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c2340"/>
      <stop offset="1" stop-color="#4a5a8c"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#sky)"/>
  <circle cx="${String(width * 0.8)}" cy="${String(height * 0.13)}" r="38" fill="#f6efd9"/>
  <ellipse cx="${String(x)}" cy="${String(height * 1.02)}" rx="${String(width * 0.9)}" ry="${String(height * 0.2)}" fill="#eef2f8"/>
  <circle cx="${String(x)}" cy="${String(height * 0.76)}" r="120" fill="#fdfdfd"/>
  <circle cx="${String(x)}" cy="${String(height * 0.52)}" r="88" fill="#fdfdfd"/>
  <circle cx="${String(x)}" cy="${String(height * 0.34)}" r="64" fill="#fdfdfd"/>
  <rect x="${String(x - 52)}" y="${String(height * 0.34 - 66)}" width="104" height="14" rx="4" fill="#2b2b33"/>
  <rect x="${String(x - 36)}" y="${String(height * 0.34 - 130)}" width="72" height="70" rx="6" fill="#2b2b33"/>
  <rect x="${String(x - 36)}" y="${String(height * 0.34 - 82)}" width="72" height="12" fill="${WINE}"/>
  <circle cx="${String(x - 22)}" cy="${String(height * 0.34 - 12)}" r="7" fill="#2b2b33"/>
  <circle cx="${String(x + 22)}" cy="${String(height * 0.34 - 12)}" r="7" fill="#2b2b33"/>
  <path d="M${String(x)} ${String(height * 0.34 + 2)} l46 10 -46 10z" fill="#e8873a"/>
  <path d="M${String(x - 70)} ${String(height * 0.34 + 50)} q70 30 140 0 v22 q-70 30 -140 0z" fill="${WINE}"/>
  <rect x="${String(x + 30)}" y="${String(height * 0.34 + 60)}" width="24" height="90" rx="6" fill="${WINE}"/>
  <circle cx="${String(x)}" cy="${String(height * 0.5)}" r="8" fill="#2b2b33"/>
  <circle cx="${String(x)}" cy="${String(height * 0.56)}" r="8" fill="#2b2b33"/>
  <path d="M${String(x - 84)} ${String(height * 0.5)} l-90 -60 M${String(x + 84)} ${String(height * 0.5)} l90 -70"
    stroke="#6b4a2f" stroke-width="8" stroke-linecap="round"/>
  ${flakes}
</svg>`;
}

/** A tune: MIDI note numbers and lengths in beats. */
type Tune = readonly (readonly [note: number, beats: number])[];

// Public-domain tunes: Jingle Bells (James Lord Pierpont, 1857), Deck the Halls
// (traditional Welsh), We Wish You a Merry Christmas (traditional English).
const JINGLE_BELLS: Tune = [
  [64, 1],
  [64, 1],
  [64, 2],
  [64, 1],
  [64, 1],
  [64, 2],
  [64, 1],
  [67, 1],
  [60, 1.5],
  [62, 0.5],
  [64, 4],
];
const DECK_THE_HALLS: Tune = [
  [67, 1.5],
  [65, 0.5],
  [64, 1],
  [62, 1],
  [60, 1],
  [62, 1],
  [64, 1],
  [60, 1],
  [62, 0.5],
  [64, 0.5],
  [65, 0.5],
  [62, 0.5],
  [64, 1.5],
  [62, 0.5],
  [60, 1],
  [59, 1],
  [60, 2],
];
const WE_WISH_YOU: Tune = [
  [62, 1],
  [67, 1],
  [67, 0.5],
  [69, 0.5],
  [67, 0.5],
  [66, 0.5],
  [64, 1],
  [64, 1],
  [64, 1],
  [69, 1],
  [69, 0.5],
  [71, 0.5],
  [69, 0.5],
  [67, 0.5],
  [66, 1],
  [62, 1],
  [62, 1],
  [71, 1],
  [71, 0.5],
  [72, 0.5],
  [71, 0.5],
  [69, 0.5],
  [67, 1],
  [64, 1],
  [62, 0.5],
  [62, 0.5],
  [64, 1],
  [69, 1],
  [66, 1],
  [67, 3],
];

const RATE = 22050;

/**
 * Plays a tune on a music box: each note a sine with a bright, slightly
 * inharmonic partial, fading out like a plucked tine.
 */
function musicBox(tune: Tune, bpm: number): Int16Array {
  const beat = 60 / bpm;
  const total = tune.reduce((sum, [, beats]) => sum + beats, 0) * beat + 1.5;
  const samples = new Float32Array(Math.ceil(total * RATE));
  let start = 0;
  for (const [note, beats] of tune) {
    const frequency = 440 * 2 ** ((note + 12 - 69) / 12);
    const first = Math.round(start * RATE);
    for (let i = 0; i < 1.5 * RATE && first + i < samples.length; i++) {
      const t = i / RATE;
      const envelope = Math.min(1, t / 0.004) * Math.exp(-3.2 * t);
      const tone =
        Math.sin(2 * Math.PI * frequency * t) +
        0.35 * Math.sin(2 * Math.PI * frequency * 2 * t) * Math.exp(-4 * t) +
        0.12 * Math.sin(2 * Math.PI * frequency * 4.2 * t) * Math.exp(-9 * t);
      samples[first + i] = (samples[first + i] ?? 0) + 0.22 * envelope * tone;
    }
    start += beats * beat;
  }
  return Int16Array.from(samples, (s) =>
    Math.round(Math.max(-1, Math.min(1, s)) * 32767),
  );
}

/** A mono 16-bit WAV file. */
function wav(pcm: Int16Array): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, Buffer.from(pcm.buffer)]);
}

/** Encodes a tune into the given files of a day's folder, by their extension. */
function melody(day: string, tune: Tune, bpm: number, names: string[]): void {
  const source = join(work, `${day}.wav`);
  writeFileSync(source, wav(musicBox(tune, bpm)));
  const codecs: Record<string, string[]> = {
    mp3: ["-c:a", "libmp3lame", "-b:a", "64k"],
    m4a: ["-c:a", "aac", "-b:a", "64k"],
    ogg: ["-c:a", "libopus", "-b:a", "32k"],
    // 8 kHz keeps the uncompressed file small.
    wav: ["-ar", "8000", "-c:a", "pcm_s16le"],
  };
  for (const name of names) {
    const codec = codecs[name.split(".").pop() ?? ""];
    if (codec === undefined) throw new Error(`no codec for ${name}`);
    ffmpeg(
      "-i",
      source,
      ...codec,
      "-map_metadata",
      "-1",
      join(DAYS, day, name),
    );
  }
}

try {
  picture("19", "landscape.jpg", shapeCard(800, 500, "16:10", "wide"));
  picture("20", "portrait.jpg", shapeCard(480, 720, "2:3", "tall"));
  picture("21", "square.jpg", shapeCard(600, 600, "1:1", "big"));
  picture("23", "snowman.jpg", snowman(600, 800));
  melody("06", JINGLE_BELLS, 180, ["jingle-bells.mp3"]);
  melody("22", DECK_THE_HALLS, 160, [
    "deck-the-halls.m4a",
    "deck-the-halls.ogg",
    "deck-the-halls.mp3",
    "deck-the-halls.wav",
  ]);
  melody("23", WE_WISH_YOU, 170, ["we-wish-you.mp3"]);
} finally {
  rmSync(work, { recursive: true, force: true });
}
