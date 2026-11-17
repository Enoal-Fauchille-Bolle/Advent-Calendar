import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * The browser script from `src/client/doors.ts`. A build compiles it next to the
 * server. Run from the sources (development, tests), the server compiles it at start
 * with the TypeScript compiler, a development dependency that a build never reaches.
 */
export function loadClientScript(): string {
  const compiled = new URL("./client/doors.js", import.meta.url);
  if (existsSync(compiled)) return readFileSync(compiled, "utf8");
  const ts = createRequire(import.meta.url)(
    "typescript",
  ) as typeof import("typescript");
  const source = readFileSync(new URL("./client/doors.ts", import.meta.url));
  return ts.transpileModule(source.toString("utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText;
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
