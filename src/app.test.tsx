import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.tsx";
import { hashPassword } from "./auth/password.ts";
import { LoginThrottle } from "./auth/throttle.ts";
import { readSettings } from "./settings.ts";

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
) {
  return createApp({
    settings: { ...readSettings(CONTENT), sizes },
    contentDir: CONTENT,
    passwordHash,
    authorPasswordHash,
    sessionSecret: "a test secret that is long enough to sign",
    throttle: new LoginThrottle(() => NOW.getTime()),
    clientScript: "",
    style: "",
    fonts: new Map([["nunito.woff2", new Uint8Array([119, 79, 70, 50])]]),
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
    expect(page).not.toContain("Mode auteur");
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
  it("shows the title, today's date, the bell and the logout", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "guest password");
    const page = await (
      await app.request(`${ORIGIN}/`, { headers: { cookie } })
    ).text();
    // The title of examples/content/calendar.json, its apostrophe escaped.
    expect(page).toContain(
      '<h1 class="header-title">Calendrier de l&#39;Avent</h1>',
    );
    expect(page).toContain('<time class="header-date" datetime="2026-12-02">');
    expect(page).toContain("Mer. 2 déc.");
    expect(page).toContain('<button type="button" class="notify" hidden="">');
    expect(page).not.toContain("author-badge");
    // The visitor's logout keeps its label on every screen.
    expect(page).toContain("<span>Se déconnecter</span>");
  });

  it("gives the author a badge and an icon-only logout on phones", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "author password");
    const page = await (
      await app.request(`${ORIGIN}/`, { headers: { cookie } })
    ).text();
    expect(page).toContain('class="author-badge"');
    expect(page).toContain('<span class="header-label">Se déconnecter</span>');
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

  it("refuses a day before its time, and its media", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "guest password");
    const day = await app.request(`${ORIGIN}/api/days/3`, {
      headers: { cookie },
    });
    expect(day.status).toBe(403);
    expect(await day.text()).not.toContain("photo");
    const media = await app.request(`${ORIGIN}/media/3/photo.png`, {
      headers: { cookie },
    });
    expect(media.status).toBe(403);
  });

  it("lets the author open every door", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "author password");
    const page = await app.request(`${ORIGIN}/`, { headers: { cookie } });
    expect(await page.text()).toContain("Mode auteur");
    const day = await app.request(`${ORIGIN}/api/days/3`, {
      headers: { cookie },
    });
    expect(day.status).toBe(200);
    const media = await app.request(`${ORIGIN}/media/3/photo.png`, {
      headers: { cookie },
    });
    expect(media.status).toBe(200);
    expect(media.headers.get("content-type")).toBe("image/png");
  });

  it("answers 404 for an empty door and a door out of range", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "author password");
    for (const path of ["/api/days/24", "/api/days/26", "/api/days/abc"]) {
      const response = await app.request(`${ORIGIN}${path}`, {
        headers: { cookie },
      });
      expect(response.status).toBe(404);
    }
  });

  it("serves a byte range of a media file", async () => {
    const app = makeApp();
    const cookie = await cookieFor(app, "author password");
    const response = await app.request(`${ORIGIN}/media/3/photo.png`, {
      headers: { cookie, range: "bytes=0-7" },
    });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toMatch(/^bytes 0-7\/\d+$/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // The PNG signature.
    expect([...bytes]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
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
