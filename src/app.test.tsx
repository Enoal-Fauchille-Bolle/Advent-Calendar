import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp, type PushDeps } from "./app.tsx";
import { hashPassword } from "./auth/password.ts";
import { LoginThrottle } from "./auth/throttle.ts";
import { type DoorAnimation, readSettings, type Settings } from "./settings.ts";

const ORIGIN = "http://localhost";
const CONTENT = "examples/content";
// Low scrypt cost: the tests check the logic, not the hash strength.
const FAST = { N: 1024, r: 8, p: 1 };
// December 2, 2026 at 12:00 in Paris: doors 1 and 2 are open, 3 is not.
const NOW = new Date("2026-12-02T11:00:00Z");

let passwordHash: string;
let authorPasswordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword("guest password", FAST);
  authorPasswordHash = await hashPassword("author password", FAST);
});

function makeApp(
  sizes: Record<string, "small" | "tall" | "wide" | "big"> = {},
  animations: Record<string, DoorAnimation> = {},
  push?: PushDeps,
  more: Partial<Settings> = {},
  contentDir = CONTENT,
  publicUrl?: string,
) {
  return createApp({
    settings: { ...readSettings(CONTENT), sizes, animations, ...more },
    contentDir,
    passwordHash,
    authorPasswordHash,
    sessionSecret: "a test secret that is long enough to sign",
    throttle: new LoginThrottle(() => NOW.getTime()),
    clientScript: "",
    style: "",
    fonts: new Map([["nunito.woff2", new Uint8Array([119, 79, 70, 50])]]),
    serviceWorker: "// sw",
    icons: new Map([
      ["icon-192.png", new Uint8Array([137, 80, 78, 71])],
      ["icon.svg", new Uint8Array([60, 115, 118, 103])],
    ]),
    shareImage: new Uint8Array([137, 80, 78, 71]),
    publicUrl,
    push,
    now: () => NOW,
  });
}

async function login(app: ReturnType<typeof makeApp>, password: string) {
  return app.request(`${ORIGIN}/login`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ password }).toString(),
  });
}

/** The session cookie a successful login sets, ready for a `cookie` header. */
async function cookieFor(app: ReturnType<typeof makeApp>, password: string) {
  const response = await login(app, password);
  expect(response.status).toBe(303);
  return (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

describe("login", () => {
  it("sends a signed-out visitor to the login page", async () => {
    const response = await makeApp().request(`${ORIGIN}/`);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login");
  });

  it("shows the login page", async () => {
    const response = await makeApp().request(`${ORIGIN}/login`);
    expect(response.status).toBe(200);
    expect(await response.text()).toMatch(/^<!DOCTYPE html>/);
  });

  it("gives the login page a generic share card, text only without a public URL", async () => {
    const page = await (await makeApp().request(`${ORIGIN}/login`)).text();
    expect(page).toContain(
      '<meta property="og:title" content="Advent calendar"/>',
    );
    expect(page).toContain(
      '<meta property="og:description" content="A surprise behind each door, until Christmas"/>',
    );
    expect(page).not.toContain("og:image");
  });

  it("adds the share picture when the public URL is set", async () => {
    const app = makeApp(
      {},
      {},
      undefined,
      {},
      CONTENT,
      "https://advent.example",
    );
    const page = await (await app.request(`${ORIGIN}/login`)).text();
    expect(page).toContain(
      '<meta property="og:image" content="https://advent.example/static/og.png"/>',
    );
    expect(page).toContain(
      '<meta name="twitter:card" content="summary_large_image"/>',
    );
  });

  it("serves the share picture without a login", async () => {
    const response = await makeApp().request(`${ORIGIN}/static/og.png`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("refuses a wrong password", async () => {
    const response = await login(makeApp(), "nope");
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("signs in with the right password and shows the calendar", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "guest password");
    const response = await app.request(`${ORIGIN}/`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const page = await response.text();
    expect(page).toContain('data-day="1"');
    expect(page).toContain('data-day="25"');
    expect(page).not.toContain("Author mode");
    // Sizes come from the content: a letter on day 1, a voucher on day 2.
    expect(page).toMatch(/class="door door--tall door--p\d" data-day="1"/);
    expect(page).toMatch(/class="door door--small door--p\d" data-day="2"/);
  });

  it("lets the settings choose a door's size", async () => {
    const app = makeApp({ "1": "big" });
    const cookie = await cookieFor(app, "guest password");
    const response = await app.request(`${ORIGIN}/`, { headers: { cookie } });
    expect(await response.text()).toMatch(
      /class="door door--big door--p\d" data-day="1"/,
    );
  });

  it("gives each door its opening animation", async () => {
    const app = makeApp({}, { "2": "none" });
    const cookie = await cookieFor(app, "guest password");
    const response = await app.request(`${ORIGIN}/`, { headers: { cookie } });
    const page = await response.text();
    // Door 2 from the settings, door 1 from the default rule.
    expect(page).toContain('data-day="2" data-animation="none"');
    expect(page).toContain('data-day="1" data-animation="tear"');
  });

  it("slows down guessing after five failures", async () => {
    const app = makeApp();
    for (let i = 0; i < 5; i += 1) {
      expect((await login(app, "nope")).status).toBe(401); // betterleaks:allow
    }
    expect((await login(app, "guest password")).status).toBe(429); // betterleaks:allow
  });

  it("refuses a login posted from another site", async () => {
    const response = await makeApp().request(`${ORIGIN}/login`, {
      method: "POST",
      headers: {
        origin: "http://evil.example",
        "sec-fetch-site": "cross-site",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "password=guest+password",
    });
    expect(response.status).toBe(403);
  });

  it("ignores an edited cookie", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "guest password");
    const edited = cookie.replace("guest", "author");
    const response = await app.request(`${ORIGIN}/`, {
      headers: { cookie: edited },
    });
    expect(response.status).toBe(302);
  });
});

describe("header", () => {
  it("gives the banner its speed and hides it when empty", async () => {
    const app = makeApp({}, {}, undefined, {
      banner: "Merry Christmas",
      bannerSpeed: 25,
    });
    const cookie = await cookieFor(app, "guest password");
    const page = await (
      await app.request(`${ORIGIN}/`, { headers: { cookie } })
    ).text();
    expect(page).toContain(
      '<div class="banner" aria-label="Merry Christmas" data-speed="25">',
    );
    const empty = makeApp({}, {}, undefined, { banner: "" });
    const plain = await (
      await empty.request(`${ORIGIN}/`, {
        headers: { cookie: await cookieFor(empty, "guest password") },
      })
    ).text();
    expect(plain).not.toContain('class="banner"');
  });

  it("shows the title, today's date and the logout", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "guest password");
    const page = await (
      await app.request(`${ORIGIN}/`, { headers: { cookie } })
    ).text();
    // The title of examples/content/calendar.json, its apostrophe escaped.
    expect(page).toContain(
      '<h1 class="header-title">Let&#39;s count to Christmas</h1>',
    );
    expect(page).toContain('<time class="header-date" datetime="2026-12-02">');
    expect(page).toContain("Wed 2 Dec");
    // Push is off here: no bell ("web push" below covers it).
    expect(page).not.toContain('class="notify"');
    expect(page).not.toContain("author-badge");
    expect(page).not.toContain("author-tools");
    expect(page).not.toContain("data-unlocked");
    // The visitor's logout keeps its label on every screen.
    expect(page).toContain("<span>Log out</span>");
  });

  it("gives the author a badge and an icon-only logout on phones", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "author password");
    const page = await (
      await app.request(`${ORIGIN}/`, { headers: { cookie } })
    ).text();
    expect(page).toContain('class="author-badge"');
    expect(page).toContain('<span class="header-label">Log out</span>');
  });

  it("gives the author the toolbar and the doors' opening dates", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "author password");
    const page = await (
      await app.request(`${ORIGIN}/`, { headers: { cookie } })
    ).text();
    expect(page).toContain('aria-label="Author tools"');
    expect(page).toContain('data-tool="open-all"');
    // On December 2, door 2 is open to visitors and door 3 is not yet.
    expect(page).toMatch(/data-day="2"[^>]*data-unlocked="true"/);
    expect(page).toMatch(/data-day="3"[^>]*data-unlocked="false"/);
    expect(page).toContain(
      '<span class="door-date" aria-hidden="true">3 Dec, 09:00</span>',
    );
  });

  it("speaks the language of the settings", async () => {
    const app = makeApp({}, {}, undefined, { language: "fr" });
    const cookie = await cookieFor(app, "guest password");
    const page = await (
      await app.request(`${ORIGIN}/`, { headers: { cookie } })
    ).text();
    expect(page).toContain('<html lang="fr">');
    expect(page).toContain("Mer. 2 déc.");
    expect(page).toContain("<span>Se déconnecter</span>");
    expect(page).toContain('data-unlocks="le 3 décembre à 09:00"');
    expect(page).toContain('"voucher":"Bon pour"');
    const login = await (await app.request(`${ORIGIN}/login`)).text();
    expect(login).toContain('<label for="password">Mot de passe</label>');
  });
});

describe("days", () => {
  it("answers 401 to a signed-out visitor", async () => {
    const response = await makeApp().request(`${ORIGIN}/api/days/1`);
    expect(response.status).toBe(401);
  });

  it("serves an open day", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "guest password");
    const response = await app.request(`${ORIGIN}/api/days/2`, {
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ day: 2 });
  });

  it("keeps French punctuation on the line of its word", async () => {
    const content = mkdtempSync(join(tmpdir(), "advent-app-"));
    mkdirSync(join(content, "days", "01"), { recursive: true });
    writeFileSync(
      join(content, "days", "01", "day.json"),
      JSON.stringify({ blocks: [{ type: "text", text: "Coucou !" }] }),
    );
    for (const [language, text] of [
      ["fr", "Coucou !"],
      ["en", "Coucou !"],
    ] as const) {
      const app = makeApp({}, {}, undefined, { language }, content);
      const cookie = await cookieFor(app, "guest password");
      const response = await app.request(`${ORIGIN}/api/days/1`, {
        headers: { cookie },
      });
      expect(await response.json()).toMatchObject({ blocks: [{ text }] });
    }
  });

  it("refuses a day before its time, and its media", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "guest password");
    const day = await app.request(`${ORIGIN}/api/days/3`, {
      headers: { cookie },
    });
    expect(day.status).toBe(403);
    expect(await day.text()).not.toContain("snow-forest");
    const media = await app.request(`${ORIGIN}/media/3/snow-forest.jpg`, {
      headers: { cookie },
    });
    expect(media.status).toBe(403);
  });

  it("lets the author open every door", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "author password");
    const page = await app.request(`${ORIGIN}/`, { headers: { cookie } });
    expect(await page.text()).toContain("Author mode");
    const day = await app.request(`${ORIGIN}/api/days/3`, {
      headers: { cookie },
    });
    expect(day.status).toBe(200);
    const media = await app.request(`${ORIGIN}/media/3/snow-forest.jpg`, {
      headers: { cookie },
    });
    expect(media.status).toBe(200);
    expect(media.headers.get("content-type")).toBe("image/jpeg");
  });

  it("answers 404 for an empty door and a door out of range", async () => {
    // A content folder with no day folder: every door is empty.
    const empty = mkdtempSync(join(tmpdir(), "advent-app-"));
    const app = makeApp({}, {}, undefined, {}, empty);
    const cookie = await cookieFor(app, "author password");
    for (const path of ["/api/days/24", "/api/days/26", "/api/days/abc"]) {
      const response = await app.request(`${ORIGIN}${path}`, {
        headers: { cookie },
      });
      expect(response.status).toBe(404);
    }
  });

  it("checks every day for the author only", async () => {
    // Day 1 is fine, day 2 is broken, day 3 names a missing file; the rest are empty.
    const content = mkdtempSync(join(tmpdir(), "advent-app-"));
    const write = (day: string, text: string) => {
      mkdirSync(join(content, "days", day), { recursive: true });
      writeFileSync(join(content, "days", day, "day.json"), text);
    };
    write("01", JSON.stringify({ blocks: [{ type: "text", text: "Hi" }] }));
    write("02", "{ not json");
    write(
      "03",
      JSON.stringify({ blocks: [{ type: "image", file: "gone.jpg" }] }),
    );
    const app = makeApp({}, {}, undefined, {}, content);

    const guest = await cookieFor(app, "guest password");
    const refused = await app.request(`${ORIGIN}/api/check`, {
      headers: { cookie: guest },
    });
    expect(refused.status).toBe(403);

    const author = await cookieFor(app, "author password");
    const response = await app.request(`${ORIGIN}/api/check`, {
      headers: { cookie: author },
    });
    expect(response.status).toBe(200);
    const { empty, problems } = (await response.json()) as {
      empty: number[];
      problems: { day: number; message: string }[];
    };
    expect(empty).toEqual(Array.from({ length: 22 }, (_, i) => i + 4));
    expect(problems.map(({ day }) => day)).toEqual([2, 3]);
    // Paths start at the content folder, as the author writes them.
    expect(problems[0]?.message).toMatch(/^Cannot read days\/02\/day\.json: /);
    expect(problems[1]?.message).toContain("gone.jpg does not exist");
    expect(problems[1]?.message).not.toContain(content);
  });

  it("serves a byte range of a media file", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "author password");
    const response = await app.request(`${ORIGIN}/media/3/snow-forest.jpg`, {
      headers: { cookie, range: "bytes=0-2" },
    });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toMatch(/^bytes 0-2\/\d+$/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // The start of every JPEG file.
    expect([...bytes]).toEqual([0xff, 0xd8, 0xff]);
  });
});

describe("other routes", () => {
  it("answers the health check without a session", async () => {
    const response = await makeApp().request(`${ORIGIN}/healthz`);
    expect(await response.text()).toBe("ok");
  });

  it("serves the fonts without a session, and no other file", async () => {
    const app = makeApp();
    const font = await app.request(`${ORIGIN}/static/fonts/nunito.woff2`);
    expect(font.status).toBe(200);
    expect(font.headers.get("content-type")).toBe("font/woff2");
    expect(new Uint8Array(await font.arrayBuffer())).toEqual(
      new Uint8Array([119, 79, 70, 50]),
    );
    const other = await app.request(`${ORIGIN}/static/fonts/..%2Fstyle.css`);
    expect(other.status).toBe(404);
  });

  it("sends a content security policy", async () => {
    const response = await makeApp().request(`${ORIGIN}/login`);
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'self'",
    );
  });
});

describe("web push", () => {
  const ENDPOINT = "https://push.example/send/abc";
  const SUBSCRIPTION = {
    endpoint: ENDPOINT,
    expirationTime: null,
    keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
  };

  function makePush(testResult: "sent" | "unknown" | "failed" = "sent") {
    const saved: unknown[] = [];
    const tested: string[] = [];
    const push = {
      publicKey: "BPublicKey",
      store: {
        add: (subscription: unknown) => saved.push(subscription),
      } as unknown as PushDeps["store"],
      test: (endpoint: string) => {
        tested.push(endpoint);
        return Promise.resolve(testResult);
      },
    };
    return { push, saved, tested };
  }

  function post(
    app: ReturnType<typeof makeApp>,
    path: string,
    body: unknown,
    cookie = "",
  ) {
    return app.request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("serves the service worker, the manifest and the icons without a session", async () => {
    const app = makeApp();
    const worker = await app.request(`${ORIGIN}/sw.js`);
    expect(worker.status).toBe(200);
    expect(worker.headers.get("content-type")).toMatch(/^text\/javascript/);
    const manifest = await app.request(`${ORIGIN}/manifest.webmanifest`);
    expect(manifest.headers.get("content-type")).toBe(
      "application/manifest+json",
    );
    expect(await manifest.json()).toMatchObject({
      name: readSettings(CONTENT).title,
      start_url: "/",
      display: "browser",
    });
    const icon = await app.request(`${ORIGIN}/static/icons/icon-192.png`);
    expect(icon.status).toBe(200);
    expect(icon.headers.get("content-type")).toBe("image/png");
    const svg = await app.request(`${ORIGIN}/static/icons/icon.svg`);
    expect(svg.status).toBe(200);
    expect(svg.headers.get("content-type")).toBe("image/svg+xml");
    expect((await app.request(`${ORIGIN}/static/icons/other.png`)).status).toBe(
      404,
    );
  });

  it("points the browser tab to the SVG icon, with the PNG as a fallback", async () => {
    const page = await (await makeApp().request(`${ORIGIN}/login`)).text();
    expect(page).toContain(
      '<link rel="icon" href="/static/icons/icon-192.png" type="image/png"/>',
    );
    expect(page).toContain(
      '<link rel="icon" href="/static/icons/icon.svg" type="image/svg+xml"/>',
    );
  });

  it("shows the bell only when push is on", async () => {
    const off = makeApp();
    const page = await off.request(`${ORIGIN}/`, {
      headers: { cookie: await cookieFor(off, "guest password") },
    });
    expect(await page.text()).not.toContain('class="notify"');

    const on = makeApp({}, {}, makePush().push);
    const html = await (
      await on.request(`${ORIGIN}/`, {
        headers: { cookie: await cookieFor(on, "guest password") },
      })
    ).text();
    expect(html).toContain('data-vapid-key="BPublicKey"');
    expect(html).not.toContain("notify-test");
  });

  it("gives the test button to the author only", async () => {
    const app = makeApp({}, {}, makePush().push);
    const html = await (
      await app.request(`${ORIGIN}/`, {
        headers: { cookie: await cookieFor(app, "author password") },
      })
    ).text();
    expect(html).toContain("notify-test");
  });

  it("saves a subscription from a signed-in visitor", async () => {
    const { push, saved } = makePush();
    const app = makeApp({}, {}, push);
    const cookie = await cookieFor(app, "guest password");
    const response = await post(
      app,
      "/api/push/subscription",
      SUBSCRIPTION,
      cookie,
    );
    expect(response.status).toBe(204);
    expect(saved).toEqual([{ endpoint: ENDPOINT, keys: SUBSCRIPTION.keys }]);
  });

  it("refuses a subscription when signed out, malformed, or with push off", async () => {
    const { push, saved } = makePush();
    const app = makeApp({}, {}, push);
    expect(
      (await post(app, "/api/push/subscription", SUBSCRIPTION)).status,
    ).toBe(401);
    const cookie = await cookieFor(app, "guest password");
    const plain = { ...SUBSCRIPTION, endpoint: "http://push.example/send/abc" };
    expect(
      (await post(app, "/api/push/subscription", plain, cookie)).status,
    ).toBe(400);
    expect(
      (await post(app, "/api/push/subscription", "nope", cookie)).status,
    ).toBe(400);
    expect(saved).toEqual([]);

    const off = makeApp();
    const offCookie = await cookieFor(off, "guest password");
    expect(
      (await post(off, "/api/push/subscription", SUBSCRIPTION, offCookie))
        .status,
    ).toBe(404);
  });

  it("sends a test to the author's device only", async () => {
    const { push, tested } = makePush("sent");
    const app = makeApp({}, {}, push);
    const guest = await cookieFor(app, "guest password");
    expect(
      (await post(app, "/api/push/test", { endpoint: ENDPOINT }, guest)).status,
    ).toBe(403);
    const author = await cookieFor(app, "author password");
    const response = await post(
      app,
      "/api/push/test",
      { endpoint: ENDPOINT },
      author,
    );
    expect(await response.json()).toEqual({ result: "sent" });
    expect(tested).toEqual([ENDPOINT]);
  });
});
