import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * A browser script: `name` is `client/doors` (the page's script, `src/client/doors.ts`)
 * or `sw/sw` (the service worker, `src/sw/sw.ts`). A build compiles both next to the
 * server. Run from the sources (development, tests), the server compiles them at start
 * with the TypeScript compiler, a development dependency that a build never reaches.
 */
function loadBrowserScript(name: "client/doors" | "sw/sw"): string {
  const compiled = new URL(`./${name}.js`, import.meta.url);
  if (existsSync(compiled)) return readFileSync(compiled, "utf8");
  const ts = createRequire(import.meta.url)(
    "typescript",
  ) as typeof import("typescript");
  const source = readFileSync(new URL(`./${name}.ts`, import.meta.url));
  return ts.transpileModule(source.toString("utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText;
}

export function loadClientScript(): string {
  return loadBrowserScript("client/doors");
}

export function loadServiceWorker(): string {
  return loadBrowserScript("sw/sw");
}

/** The stylesheet, `assets/style.css`, one folder above both `src/` and `dist/`. */
export function loadStyle(): string {
  return readFileSync(new URL("../assets/style.css", import.meta.url), "utf8");
}

/** The font files the stylesheet loads, by the name it uses in their URL. */
export const FONT_FILES = ["fraunces.woff2", "nunito.woff2"] as const;

/** Each font of `assets/fonts/`, read once at start like the stylesheet. */
export function loadFonts(): ReadonlyMap<string, Uint8Array<ArrayBuffer>> {
  return new Map(
    FONT_FILES.map((name) => [
      name,
      readFileSync(new URL(`../assets/fonts/${name}`, import.meta.url)),
    ]),
  );
}

/** Icon sizes in pixels, for the manifest and the notifications. */
export const ICON_SIZES = [192, 512] as const;

/**
 * Each icon of `assets/icons/`: `icon-192.png` and `icon-512.png`, and `icon.svg` for
 * the browser tab.
 */
export function loadIcons(): ReadonlyMap<string, Uint8Array<ArrayBuffer>> {
  return new Map(
    [...ICON_SIZES.map((size) => `icon-${String(size)}.png`), "icon.svg"].map(
      (name) => [
        name,
        readFileSync(new URL(`../assets/icons/${name}`, import.meta.url)),
      ],
    ),
  );
}
