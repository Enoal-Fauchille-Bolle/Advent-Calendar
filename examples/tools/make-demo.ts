// Builds the demo published on GitHub Pages: a frozen copy of the example calendar,
// as the author sees it on the 14th of its month. GitHub Pages only serves files, so
// this script runs the app in memory, signs in with the author password, and saves
// what a browser would fetch: the login page, the calendar, each door's content, its
// photos and sounds, the content check, the stylesheet, the script, fonts and icons.
// Addresses become relative to the page, so the copy works in any folder.
//
// In the copy, the login form opens the calendar whatever is typed (the field has no
// name, so nothing typed leaves the page), a note on the login page says so, and
// logout goes back to the login page. Notifications are off, as without a VAPID key.
//
// Run from the repository root, after `pnpm install` (with tsx, as the app's pages
// are JSX, which plain `node` cannot read):
//   pnpm exec tsx examples/tools/make-demo.ts [--out dist/pages] [--url https://…/demo]
// Writes <out>/demo/ and <out>/index.html, which forwards to demo/. `--url` is the
// demo's full address, for the picture of a shared link's card; without it, the card
// has text only. The workflow .github/workflows/demo.yml publishes <out>.

import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createApp } from "../../src/app.tsx";
import { hashPassword } from "../../src/auth/password.ts";
import { LoginThrottle } from "../../src/auth/throttle.ts";
import {
  FONT_FILES,
  ICON_SIZES,
  loadClientScript,
  loadFonts,
  loadIcons,
  loadServiceWorker,
  loadShareImage,
  loadStyle,
} from "../../src/client-script.ts";
import { translation } from "../../src/i18n/index.ts";
import { readSettings } from "../../src/settings.ts";
import { calendarDays } from "../../src/unlock.ts";

const CONTENT = "examples/content";
/** The day the copy is frozen on: doors up to it are open for a visitor. */
const DEMO_DAY = 14;
/** Any address will do: the app only compares it with the request's `Origin`. */
const ORIGIN = "http://demo.invalid";

const args = process.argv.slice(2);
function option(name: string): string | undefined {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined) throw new Error(`${name} expects a value`);
  return value;
}
const OUT = option("--out") ?? "dist/pages";
const URL_ARG = option("--url")?.replace(/\/+$/, "");

const settings = readSettings(CONTENT);
const pad = (n: number) => String(n).padStart(2, "0");
// Noon UTC falls on the same day from UTC-11 to UTC+11, whatever the calendar's timezone.
const NOW = new Date(
  `${String(settings.year)}-${pad(settings.month)}-${pad(DEMO_DAY)}T12:00:00Z`,
);
const t = translation(settings.language);
const shownDate = t.shortDate(NOW, settings.timezone);

// Made at each run: the app lives only as long as the script.
const password = randomBytes(12).toString("hex");
const app = createApp({
  settings,
  contentDir: CONTENT,
  // A malformed hash never matches: only the author signs in.
  passwordHash: "none",
  authorPasswordHash: await hashPassword(password),
  sessionSecret: randomBytes(32).toString("base64"),
  throttle: new LoginThrottle(),
  clientScript: loadClientScript(),
  style: loadStyle(),
  fonts: loadFonts(),
  serviceWorker: loadServiceWorker(),
  icons: loadIcons(),
  shareImage: loadShareImage(),
  publicUrl: URL_ARG,
  now: () => NOW,
});

async function request(path: string, init: RequestInit = {}) {
  return app.request(`${ORIGIN}${path}`, init);
}

const login = await request("/login", {
  method: "POST",
  headers: {
    Origin: ORIGIN,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ password }).toString(),
});
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (login.status !== 303 || cookie === undefined) {
  throw new Error(`Author login failed: ${String(login.status)}`);
}

/** A signed-in GET; `null` for a 404, an error for any other failure. */
async function get(path: string): Promise<Response | null> {
  const response = await request(path, { headers: { Cookie: cookie ?? "" } });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GET ${path}: ${String(response.status)}`);
  }
  return response;
}

async function text(path: string): Promise<string> {
  const response = await get(path);
  if (response === null) throw new Error(`GET ${path}: 404`);
  return response.text();
}

async function bytes(path: string): Promise<Uint8Array> {
  const response = await get(path);
  if (response === null) throw new Error(`GET ${path}: 404`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Replaces every `from` in `source`. Fails when there is none, so a change in the app
 * that this copy depends on stops the build instead of publishing a broken demo.
 */
function rewrite(source: string, from: string, to: string, what: string) {
  if (!source.includes(from)) {
    throw new Error(`${what}: "${from}" not found; update make-demo.ts`);
  }
  return source.replaceAll(from, to);
}

/** The page's own addresses, made relative to it. */
function relativePage(html: string, what: string): string {
  let out = rewrite(html, 'href="/static/', 'href="static/', what);
  out = rewrite(
    out,
    'href="/manifest.webmanifest"',
    'href="manifest.webmanifest"',
    what,
  );
  return out.replaceAll('src="/static/', 'src="static/');
}

const demo = join(OUT, "demo");
rmSync(OUT, { recursive: true, force: true });

function save(path: string, data: string | Uint8Array): void {
  const file = join(demo, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}

// The login page, where the demo starts.
const note = `This is a demo: any password opens the calendar, in author mode, as it looks on ${shownDate}.`;
let loginPage = relativePage(
  await (await request("/login")).text(),
  "login page",
);
loginPage = rewrite(
  loginPage,
  '<form method="post" action="/login" class="login-form">',
  '<form method="get" action="calendar.html" class="login-form">',
  "login form",
);
loginPage = rewrite(loginPage, ' name="password"', "", "password field");
loginPage = rewrite(
  loginPage,
  'autocomplete="current-password"',
  'autocomplete="off"',
  "password field",
);
loginPage = rewrite(
  loginPage,
  "</form>",
  `</form><p class="demo-note">${note}</p>`,
  "login form",
);
save("index.html", loginPage);

// The calendar, in author mode.
let calendar = relativePage(await text("/"), "calendar");
calendar = rewrite(
  calendar,
  '<form method="post" action="/logout" class="logout">',
  '<form method="get" action="index.html" class="logout">',
  "logout form",
);
save("calendar.html", calendar);

// Each door's content, and the files it shows.
for (const day of calendarDays(settings)) {
  const response = await get(`/api/days/${String(day)}`);
  // An empty day stays missing: the page then says the door is empty, as live.
  if (response === null) continue;
  const shown = (await response.json()) as {
    blocks: { type: string; url?: string }[];
  };
  for (const block of shown.blocks) {
    if (block.url === undefined) continue;
    save(block.url.slice(1), await bytes(block.url));
    block.url = block.url.slice(1);
  }
  save(`api/days/${String(day)}.json`, JSON.stringify(shown));
}
save("api/check.json", await text("/api/check"));

// The stylesheet, with the demo note's look; fonts are next to it.
let style = rewrite(
  await text("/static/style.css"),
  'url("/static/fonts/',
  'url("fonts/',
  "stylesheet",
);
style += `
/* Demo only (examples/tools/make-demo.ts): the note under the login form. */
.demo-note {
  margin: 1rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.4;
  text-align: center;
}
`;
save("static/style.css", style);
for (const font of FONT_FILES) {
  save(`static/fonts/${font}`, await bytes(`/static/fonts/${font}`));
}

let script = await text("/static/doors.js");
script = rewrite(
  script,
  "`/api/days/${day}`",
  "`api/days/${day}.json`",
  "doors.js",
);
script = rewrite(script, '"/api/check"', '"api/check.json"', "doors.js");
script = rewrite(script, '"/login"', '"index.html"', "doors.js");
save("static/doors.js", script);

const icons = [
  ...ICON_SIZES.map((size) => `icon-${String(size)}.png`),
  "icon.svg",
];
for (const icon of icons) {
  save(`static/icons/${icon}`, await bytes(`/static/icons/${icon}`));
}
save("static/og.png", await bytes("/static/og.png"));

const manifest = JSON.parse(await text("/manifest.webmanifest")) as {
  start_url: string;
  icons: { src: string }[];
};
manifest.start_url = "calendar.html";
for (const icon of manifest.icons) icon.src = icon.src.slice(1);
save("manifest.webmanifest", JSON.stringify(manifest));

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// The site's root forwards to the demo, until other pages take it.
writeFileSync(
  join(OUT, "index.html"),
  `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(settings.title)}</title>
    <meta http-equiv="refresh" content="0; url=demo/" />
  </head>
  <body>
    <p><a href="demo/">Open the demo</a></p>
  </body>
</html>
`,
);

console.log(`Demo written to ${demo}, frozen on ${NOW.toISOString()}`);
