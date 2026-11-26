// Takes the picture at the top of the README: the example calendar on a
// desktop, a tablet and a phone, each in a plain device frame, in light and
// dark mode. Writes docs/images/screenshot-light.png and screenshot-dark.png.
// Also takes the picture of a shared link's card, assets/og.png (1200x630):
// a desktop and a phone, in light mode.
//
// Run from the repository root, after `pnpm install`:
//   node examples/tools/make-screenshot.ts          # both
//   node examples/tools/make-screenshot.ts readme   # the README pictures only
//   node examples/tools/make-screenshot.ts share    # assets/og.png only
// Needs Firefox, driven over WebDriver BiDi (no geckodriver), and ffmpeg built
// with librsvg (SVG to PNG). The header shows the day the script runs.

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = "docs/images";
const SHARE_OUT = "assets/og.png";
const MODE = process.argv[2] ?? "all";
if (!["all", "readme", "share"].includes(MODE)) {
  throw new Error(`Unknown mode "${MODE}": expected readme or share`);
}
// Made at each run: the server only lives as long as the script.
const PASSWORD = randomBytes(12).toString("hex");
// The showcase days show their preview; the tour days stay closed.
const OPENED = Array.from({ length: 14 }, (_, i) => String(i + 1));

type Theme = "light" | "dark";
type DeviceName = "desktop" | "tablet" | "phone";

/** Viewport in CSS pixels. */
const VIEWPORTS: Record<DeviceName, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
};

const work = mkdtempSync(join(tmpdir(), "advent-screenshot-"));
const children: ChildProcess[] = [];

/** A free TCP port on the loopback interface. */
async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  if (address === null || typeof address === "string") {
    throw new Error("No port");
  }
  return address.port;
}

/** Starts a process in its own group, so stopping it also stops its children. */
function start(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  return child;
}

function stopAll(): void {
  for (const child of children) {
    if (child.pid !== undefined && child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }
}

/** Waits for a line of a process's output that matches, and returns the match. */
async function waitFor(child: ChildProcess, pattern: RegExp) {
  let seen = "";
  const streams = [child.stdout, child.stderr].filter((s) => s !== null);
  return new Promise<RegExpMatchArray>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${String(pattern)}:\n${seen}`));
    }, 30_000);
    for (const stream of streams) {
      stream.on("data", (chunk: Buffer) => {
        seen += chunk.toString();
        const match = pattern.exec(seen);
        if (match !== null) {
          clearTimeout(timer);
          resolve(match);
        }
      });
    }
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Exited with ${String(code)}:\n${seen}`));
    });
  });
}

/** The example calendar with every door unlocked: a year already past. */
function unlockedContent(): string {
  const dir = join(work, "content");
  cpSync("examples/content", dir, { recursive: true });
  const file = join(dir, "calendar.json");
  const calendar = JSON.parse(readFileSync(file, "utf8")) as {
    year: number;
  };
  calendar.year = new Date().getFullYear() - 1;
  writeFileSync(file, JSON.stringify(calendar));
  return dir;
}

async function startServer(): Promise<string> {
  const hash = execFileSync("node", ["src/cli/hash-password.ts"], {
    input: PASSWORD,
    encoding: "utf8",
  }).trim();
  const port = await freePort();
  const server = start("node_modules/.bin/tsx", ["src/main.ts"], {
    ADVENT_PASSWORD_HASH: hash,
    ADVENT_SESSION_SECRET: randomBytes(32).toString("base64"),
    ADVENT_CONTENT_DIR: unlockedContent(),
    ADVENT_HOST: "127.0.0.1",
    ADVENT_PORT: String(port),
  });
  await waitFor(server, /listening on/);
  return `http://127.0.0.1:${String(port)}`;
}

type Message = {
  id?: number;
  type?: string;
  result?: Record<string, unknown>;
  error?: string;
  message?: string;
};

/** A minimal WebDriver BiDi client: one command at a time is enough here. */
class Browser {
  #socket: WebSocket;
  #next = 1;
  #pending = new Map<
    number,
    {
      resolve: (result: Record<string, unknown>) => void;
      reject: (error: Error) => void;
    }
  >();
  context = "";

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.addEventListener("message", (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as Message;
      if (message.id === undefined) return;
      const pending = this.#pending.get(message.id);
      this.#pending.delete(message.id);
      if (message.type === "error") {
        pending?.reject(
          new Error(`${message.error ?? ""}: ${message.message ?? ""}`),
        );
      } else {
        pending?.resolve(message.result ?? {});
      }
    });
  }

  static async open(theme: Theme): Promise<Browser> {
    const profile = join(work, `profile-${theme}`);
    // 0 asks pages for dark mode, 1 for light mode.
    const scheme = theme === "dark" ? 0 : 1;
    mkdirSync(profile);
    writeFileSync(
      join(profile, "user.js"),
      [
        `user_pref("layout.css.prefers-color-scheme.content-override", ${String(scheme)});`,
        `user_pref("browser.shell.checkDefaultBrowser", false);`,
        `user_pref("datareporting.policy.dataSubmissionEnabled", false);`,
      ].join("\n"),
    );
    const port = await freePort();
    const firefox = start(
      "firefox",
      [
        "--headless",
        "--no-remote",
        "--profile",
        profile,
        `--remote-debugging-port=${String(port)}`,
      ],
      {},
    );
    const [, url] = await waitFor(
      firefox,
      /WebDriver BiDi listening on (ws:\/\/\S+)/,
    );
    const socket = new WebSocket(`${url ?? ""}/session`);
    await once(socket, "open");
    const browser = new Browser(socket);
    await browser.send("session.new", { capabilities: {} });
    const tree = await browser.send("browsingContext.getTree", {});
    const [first] = tree.contexts as { context: string }[];
    browser.context = first?.context ?? "";
    return browser;
  }

  send(method: string, params: object): Promise<Record<string, unknown>> {
    const id = this.#next++;
    this.#socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
    });
  }

  /** Runs an expression in the page and waits for it if it is a promise. */
  async run(expression: string): Promise<void> {
    const result = await this.send("script.evaluate", {
      expression,
      target: { context: this.context },
      awaitPromise: true,
    });
    if (result.type === "exception") {
      throw new Error(`In the page: ${JSON.stringify(result)}`);
    }
  }

  async goto(url: string): Promise<void> {
    await this.send("browsingContext.navigate", {
      context: this.context,
      url,
      wait: "complete",
    });
  }

  /** The visible part of the page, as a PNG data URL. */
  async capture(device: DeviceName, url: string): Promise<string> {
    await this.send("browsingContext.setViewport", {
      context: this.context,
      viewport: VIEWPORTS[device],
      devicePixelRatio: 1,
    });
    await this.goto(url);
    await this.run(`(async () => {
      document.documentElement.style.scrollbarWidth = "none";
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) =>
        image.complete ? null : new Promise((done) => { image.onload = image.onerror = done; })));
    })()`);
    await sleep(500);
    const shot = await this.send("browsingContext.captureScreenshot", {
      context: this.context,
      origin: "viewport",
    });
    return `data:image/png;base64,${String(shot.data)}`;
  }

  async close(): Promise<void> {
    await this.send("browser.close", {}).catch(() => undefined);
  }
}

/** Device colours: dark bezels on a light page, lighter ones with an edge on a dark page. */
const FRAME: Record<
  Theme,
  { bezel: string; edge: string; stand: string; base: string; shadow: number }
> = {
  light: {
    bezel: "#1f1f23",
    edge: "#1f1f23",
    stand: "#c4c4cb",
    base: "#aeaeb6",
    shadow: 0.25,
  },
  dark: {
    bezel: "#2c2c32",
    edge: "#4a4a52",
    stand: "#3c3c43",
    base: "#2c2c32",
    shadow: 0.6,
  },
};

type Placed = {
  shot: string;
  device: DeviceName;
  x: number;
  y: number;
  scale: number;
  bezel: number;
  radius: number;
};

/** A screen in its bezel, its top-left corner at (x, y). */
function frame(placed: Placed, theme: Theme): string {
  const { shot, device, x, y, scale, bezel, radius } = placed;
  const colours = FRAME[theme];
  const width = VIEWPORTS[device].width * scale;
  const height = VIEWPORTS[device].height * scale;
  const inner = Math.max(radius - bezel, 4);
  const id = `screen-${device}`;
  return `<g filter="url(#shadow)">
    <rect x="${String(x)}" y="${String(y)}" width="${String(width + 2 * bezel)}" height="${String(height + 2 * bezel)}"
      rx="${String(radius)}" fill="${colours.bezel}" stroke="${colours.edge}" stroke-width="2"/>
  </g>
  <clipPath id="${id}">
    <rect x="${String(x + bezel)}" y="${String(y + bezel)}" width="${String(width)}" height="${String(height)}" rx="${String(inner)}"/>
  </clipPath>
  <image x="${String(x + bezel)}" y="${String(y + bezel)}" width="${String(width)}" height="${String(height)}"
    href="${shot}" clip-path="url(#${id})"/>`;
}

/** Desktop at the back, tablet in front on the left, phone in front on the right. */
function compose(shots: Record<DeviceName, string>, theme: Theme): string {
  const colours = FRAME[theme];
  const width = 1600;
  const height = 920;
  const desktop: Placed = {
    shot: shots.desktop,
    device: "desktop",
    x: 260,
    y: 24,
    scale: 0.75,
    bezel: 22,
    radius: 24,
  };
  const screenWidth =
    VIEWPORTS.desktop.width * desktop.scale + 2 * desktop.bezel;
  const screenBottom =
    desktop.y + VIEWPORTS.desktop.height * desktop.scale + 2 * desktop.bezel;
  const centre = desktop.x + screenWidth / 2;
  const tablet: Placed = {
    shot: shots.tablet,
    device: "tablet",
    x: 40,
    y: height - 24 - (VIEWPORTS.tablet.height * 0.5 + 2 * 22),
    scale: 0.5,
    bezel: 22,
    radius: 36,
  };
  const phoneWidth = VIEWPORTS.phone.width * 0.55 + 2 * 12;
  const phone: Placed = {
    shot: shots.phone,
    device: "phone",
    x: width - 40 - phoneWidth,
    y: height - 24 - (VIEWPORTS.phone.height * 0.55 + 2 * 12),
    scale: 0.55,
    bezel: 12,
    radius: 34,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="${String(colours.shadow)}"/>
    </filter>
  </defs>
  <path d="M${String(centre - 50)} ${String(screenBottom - 2)} h100 l18 92 h-136 z" fill="${colours.stand}"/>
  <rect x="${String(centre - 160)}" y="${String(screenBottom + 88)}" width="320" height="16" rx="8" fill="${colours.base}"/>
  ${frame(desktop, theme)}
  ${frame(tablet, theme)}
  ${frame(phone, theme)}
</svg>`;
}

/** Background of the share picture: the page's paper colour in light mode. */
const SHARE_PAPER = "#fbf6ee";

/**
 * The share picture, 1200x630 as messaging apps expect: the desktop on the left, the
 * phone on the right, on the page's paper.
 */
function composeShare(desktopShot: string, phoneShot: string): string {
  const width = 1200;
  const height = 630;
  const colours = FRAME.light;
  const desktop: Placed = {
    shot: desktopShot,
    device: "desktop",
    x: 70,
    y: 36,
    scale: 0.52,
    bezel: 14,
    radius: 16,
  };
  const screenWidth =
    VIEWPORTS.desktop.width * desktop.scale + 2 * desktop.bezel;
  const screenBottom =
    desktop.y + VIEWPORTS.desktop.height * desktop.scale + 2 * desktop.bezel;
  const centre = desktop.x + screenWidth / 2;
  const phone: Placed = {
    shot: phoneShot,
    device: "phone",
    x: width - 70 - (VIEWPORTS.phone.width * 0.6 + 2 * 10),
    y: height - 30 - (VIEWPORTS.phone.height * 0.6 + 2 * 10),
    scale: 0.6,
    bezel: 10,
    radius: 28,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="${String(colours.shadow)}"/>
    </filter>
  </defs>
  <rect width="${String(width)}" height="${String(height)}" fill="${SHARE_PAPER}"/>
  <path d="M${String(centre - 34)} ${String(screenBottom - 2)} h68 l12 60 h-92 z" fill="${colours.stand}"/>
  <rect x="${String(centre - 110)}" y="${String(screenBottom + 56)}" width="220" height="12" rx="6" fill="${colours.base}"/>
  ${frame(desktop, "light")}
  ${frame(phone, "light")}
</svg>`;
}

/** Turns an SVG into a PNG with ffmpeg. */
function svgToPng(svg: string, png: string): void {
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    svg,
    "-frames:v",
    "1",
    "-compression_level",
    "9",
    png,
  ]);
}

async function main(): Promise<void> {
  const base = await startServer();
  const themes =
    MODE === "share" ? (["light"] as const) : (["light", "dark"] as const);
  for (const theme of themes) {
    const browser = await Browser.open(theme);
    await browser.goto(`${base}/login`);
    await browser.run(`(async () => {
      const response = await fetch("/login", {
        method: "POST",
        body: new URLSearchParams({ password: ${JSON.stringify(PASSWORD)} }),
      });
      if (!response.ok || new URL(response.url).pathname !== "/") throw new Error("Login failed");
      localStorage.setItem("advent-calendar:opened", ${JSON.stringify(JSON.stringify(OPENED))});
    })()`);
    const shots = {
      desktop: await browser.capture("desktop", `${base}/`),
      tablet: await browser.capture("tablet", `${base}/`),
      phone: await browser.capture("phone", `${base}/`),
    };
    await browser.close();
    if (MODE !== "share") {
      const svg = join(work, `screenshot-${theme}.svg`);
      writeFileSync(svg, compose(shots, theme));
      svgToPng(svg, join(OUT, `screenshot-${theme}.png`));
      console.log(`${OUT}/screenshot-${theme}.png`);
    }
    if (MODE !== "readme" && theme === "light") {
      const svg = join(work, "share.svg");
      writeFileSync(svg, composeShare(shots.desktop, shots.phone));
      svgToPng(svg, SHARE_OUT);
      console.log(SHARE_OUT);
    }
  }
}

try {
  await main();
} finally {
  stopAll();
  rmSync(work, { recursive: true, force: true });
}
