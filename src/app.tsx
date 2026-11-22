import { open } from "node:fs/promises";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import { verifyPassword, PASSWORD_MAX_LENGTH } from "./auth/password.ts";
import {
  decodeSession,
  encodeSession,
  SESSION_COOKIE,
  SESSION_DAYS,
  type Role,
} from "./auth/session.ts";
import type { LoginThrottle } from "./auth/throttle.ts";
import { ICON_SIZES } from "./client-script.ts";
import { DayError, doorSize, findMedia, loadDay } from "./days.ts";
import { translation } from "./i18n/index.ts";
import { CalendarPage } from "./pages/calendar.tsx";
import { LoginPage } from "./pages/login.tsx";
import type { TestResult } from "./push/schedule.ts";
import { type PushStore, subscriptionSchema } from "./push/store.ts";
import type { DoorSize, Settings } from "./settings.ts";
import { calendarDays, isInRange, isUnlocked } from "./unlock.ts";

export interface AppDeps {
  settings: Settings;
  contentDir: string;
  passwordHash: string;
  authorPasswordHash: string | undefined;
  sessionSecret: string;
  throttle: LoginThrottle;
  clientScript: string;
  style: string;
  /** The font files of `assets/fonts/`, by file name. */
  fonts: ReadonlyMap<string, Uint8Array<ArrayBuffer>>;
  /** The service worker, from `src/sw/sw.ts`. */
  serviceWorker: string;
  /** The icons of `assets/icons/`, by file name. */
  icons: ReadonlyMap<string, Uint8Array<ArrayBuffer>>;
  /** Web push; absent when no VAPID key is set. */
  push?: PushDeps | undefined;
  /** The current time; tests replace it. */
  now?: () => Date;
}

export interface PushDeps {
  /** The VAPID public key, which the browser needs to subscribe. */
  publicKey: string;
  store: PushStore;
  /** Sends the test notification to one saved subscription. */
  test: (endpoint: string) => Promise<TestResult>;
}

type Env = { Variables: { role: Role } };

/** Secure cookie only when the visitor used HTTPS, as the proxy or the address says. */
function usesHttps(c: Context): boolean {
  const forwarded = c.req
    .header("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwarded !== undefined && forwarded !== "") return forwarded === "https";
  return new URL(c.req.url).protocol === "https:";
}

/** A door number from the URL, or `null` when it is not a plain whole number. */
function parseDay(text: string): number | null {
  return /^\d{1,2}$/.test(text) ? Number(text) : null;
}

/** The first range of a `Range: bytes=…` header, or `null` when there is none to honour. */
function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | "invalid" | null {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null) return null;
  const [, from = "", to = ""] = match;
  if (from === "" && to === "") return "invalid";
  let start: number;
  let end: number;
  if (from === "") {
    // `bytes=-500`: the last 500 bytes.
    start = Math.max(0, size - Number(to));
    end = size - 1;
  } else {
    start = Number(from);
    end = to === "" ? size - 1 : Math.min(Number(to), size - 1);
  }
  return start > end || start >= size ? "invalid" : { start, end };
}

export function createApp(deps: AppDeps): Hono<Env> {
  const { settings, contentDir, throttle } = deps;
  const now = deps.now ?? (() => new Date());
  const t = translation(settings.language);
  const app = new Hono<Env>();

  app.use(async (c, next) => {
    await next();
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "same-origin");
  });
  app.use(csrf());

  app.get("/healthz", (c) => c.text("ok"));
  app.get("/static/style.css", (c) =>
    c.body(deps.style, 200, { "Content-Type": "text/css; charset=UTF-8" }),
  );
  app.get("/static/doors.js", (c) =>
    c.body(deps.clientScript, 200, {
      "Content-Type": "text/javascript; charset=UTF-8",
    }),
  );
  // Public like the stylesheet: the login page uses the fonts too.
  app.get("/static/fonts/:file", (c) => {
    const font = deps.fonts.get(c.req.param("file"));
    if (font === undefined) return c.notFound();
    return c.body(font, 200, { "Content-Type": "font/woff2" });
  });
  // Public: the browser fetches the service worker, the manifest and the icons
  // without the login cookie, and none of them holds anything of the calendar
  // beyond its title, which the login page shows anyway.
  app.get("/sw.js", (c) =>
    c.body(deps.serviceWorker, 200, {
      "Content-Type": "text/javascript; charset=UTF-8",
      "Cache-Control": "no-cache",
    }),
  );
  app.get("/manifest.webmanifest", (c) =>
    c.body(
      JSON.stringify({
        name: settings.title,
        short_name: settings.title,
        start_url: "/",
        display: "browser",
        background_color: "#fbf6ee",
        theme_color: "#7a1f3d",
        icons: ICON_SIZES.map((size) => ({
          src: `/static/icons/icon-${String(size)}.png`,
          sizes: `${String(size)}x${String(size)}`,
          type: "image/png",
        })),
      }),
      200,
      { "Content-Type": "application/manifest+json" },
    ),
  );
  app.get("/static/icons/:file", (c) => {
    const icon = deps.icons.get(c.req.param("file"));
    if (icon === undefined) return c.notFound();
    return c.body(icon, 200, {
      "Content-Type": c.req.param("file").endsWith(".svg")
        ? "image/svg+xml"
        : "image/png",
    });
  });

  const readRole = async (c: Context<Env>): Promise<Role | null> => {
    const value = await getSignedCookie(c, deps.sessionSecret, SESSION_COOKIE);
    return typeof value === "string" ? decodeSession(value, now()) : null;
  };

  app.get("/login", async (c) => {
    if ((await readRole(c)) !== null) return c.redirect("/");
    return c.html(<LoginPage title={settings.title} t={t} />);
  });

  app.post("/login", bodyLimit({ maxSize: 16 * 1024 }), async (c) => {
    const wait = throttle.take();
    if (wait > 0) {
      return c.html(
        <LoginPage
          title={settings.title}
          t={t}
          error={t.login.tooMany(wait)}
        />,
        429,
      );
    }
    const body = await c.req.parseBody();
    const password = typeof body.password === "string" ? body.password : "";

    let role: Role | null = null;
    if (password !== "" && password.length <= PASSWORD_MAX_LENGTH) {
      if (await verifyPassword(password, deps.passwordHash)) role = "guest";
      else if (
        deps.authorPasswordHash !== undefined &&
        (await verifyPassword(password, deps.authorPasswordHash))
      ) {
        role = "author";
      }
    }
    if (role === null) {
      return c.html(
        <LoginPage title={settings.title} t={t} error={t.login.wrong} />,
        401,
      );
    }

    throttle.recordSuccess();
    await setSignedCookie(
      c,
      SESSION_COOKIE,
      encodeSession(role, now()),
      deps.sessionSecret,
      {
        path: "/",
        httpOnly: true,
        secure: usesHttps(c),
        sameSite: "Lax",
        maxAge: SESSION_DAYS * 24 * 60 * 60,
      },
    );
    return c.redirect("/", 303);
  });

  app.post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.redirect("/login", 303);
  });

  // Everything below needs a signed-in visitor.
  app.use(async (c, next) => {
    const role = await readRole(c);
    if (role === null) {
      if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/media/")) {
        return c.json({ error: "signed out" }, 401);
      }
      return c.redirect("/login");
    }
    c.set("role", role);
    await next();
  });

  app.get("/", async (c) => {
    // A size chosen in the settings wins; the others come from each day's content.
    const sizes = new Map<number, DoorSize>(
      await Promise.all(
        calendarDays(settings).map(async (day): Promise<[number, DoorSize]> => [
          day,
          settings.sizes[String(day)] ?? (await doorSize(contentDir, day)),
        ]),
      ),
    );
    return c.html(
      <CalendarPage
        settings={settings}
        role={c.var.role}
        now={now()}
        sizes={sizes}
        vapidKey={deps.push?.publicKey}
      />,
    );
  });

  /** `null` when the visitor may see the day; otherwise the response to send. */
  const refuse = (c: Context<Env>, day: number | null) => {
    if (day === null || !isInRange(day, settings)) {
      return c.json({ error: "no such door" }, 404);
    }
    if (c.var.role !== "author" && !isUnlocked(day, settings, now())) {
      return c.json({ error: "locked" }, 403);
    }
    return null;
  };

  app.get("/api/days/:day", (c) => {
    const day = parseDay(c.req.param("day"));
    const refused = refuse(c, day);
    if (refused !== null || day === null) return refused ?? c.notFound();
    try {
      const shown = loadDay(contentDir, day);
      if (shown === null) return c.json({ error: "empty" }, 404);
      c.header("Cache-Control", "private, no-store");
      return c.json(shown);
    } catch (error) {
      if (!(error instanceof DayError)) throw error;
      console.error(`${now().toISOString()} ${error.message}`);
      return c.json({ error: "broken door" }, 500);
    }
  });

  /** The JSON body of a push request, or `null` when it is not JSON. */
  const readJson = async (c: Context<Env>): Promise<unknown> => {
    try {
      return (await c.req.json()) as unknown;
    } catch {
      return null;
    }
  };

  // Saves this browser's push subscription; it sends it again on each visit.
  app.post(
    "/api/push/subscription",
    bodyLimit({ maxSize: 4 * 1024 }),
    async (c) => {
      if (deps.push === undefined) return c.json({ error: "no push" }, 404);
      const parsed = subscriptionSchema.safeParse(await readJson(c));
      if (!parsed.success) return c.json({ error: "bad subscription" }, 400);
      const { endpoint, keys } = parsed.data;
      deps.push.store.add({
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      });
      return c.body(null, 204);
    },
  );

  // Author mode: a test notification to the device that asks, and to it only.
  app.post("/api/push/test", bodyLimit({ maxSize: 4 * 1024 }), async (c) => {
    if (deps.push === undefined) return c.json({ error: "no push" }, 404);
    if (c.var.role !== "author") return c.json({ error: "author only" }, 403);
    const parsed = subscriptionSchema
      .pick({ endpoint: true })
      .safeParse(await readJson(c));
    if (!parsed.success) return c.json({ error: "bad endpoint" }, 400);
    return c.json({ result: await deps.push.test(parsed.data.endpoint) });
  });

  app.get("/media/:day/:file", async (c) => {
    const day = parseDay(c.req.param("day"));
    const refused = refuse(c, day);
    if (refused !== null || day === null) return refused ?? c.notFound();
    const media = findMedia(contentDir, day, c.req.param("file"));
    if (media === null) return c.json({ error: "no such file" }, 404);

    const headers: Record<string, string> = {
      "Content-Type": media.type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    };
    // Safari plays audio only from a server that answers byte ranges.
    const range = parseRange(c.req.header("range"), media.size);
    if (range === "invalid") {
      return c.body(null, 416, {
        "Content-Range": `bytes */${String(media.size)}`,
      });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? media.size - 1;
    const length = Math.max(0, end - start + 1);
    const bytes = new Uint8Array(length);
    const file = await open(media.path, "r");
    try {
      await file.read(bytes, 0, length, start);
    } finally {
      await file.close();
    }
    if (range === null) return c.body(bytes, 200, headers);
    return c.body(bytes, 206, {
      ...headers,
      "Content-Range": `bytes ${String(start)}-${String(end)}/${String(media.size)}`,
    });
  });

  return app;
}
