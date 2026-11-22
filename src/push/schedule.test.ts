import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSettings } from "../settings.ts";
import {
  type PushDeps,
  type PushMessage,
  sendDueDoor,
  sendTest,
} from "./schedule.ts";
import { PushStore, type Subscription } from "./store.ts";

const sub = (n: number): Subscription => ({
  endpoint: `https://push.example/${String(n)}`,
  keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
});

/** Paris is UTC+1 in December: 08:00Z is 09:00 there. */
const at = (iso: string) => new Date(iso);

function setup(
  options: {
    notification?: string;
    days?: Record<number, unknown>;
    fail?: Record<string, number>;
  } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "schedule-"));
  const content = join(root, "content");
  for (const [day, data] of Object.entries(options.days ?? {})) {
    const folder = join(content, "days", day.padStart(2, "0"));
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "day.json"), JSON.stringify(data));
  }
  const store = new PushStore(join(root, "state"));
  store.prepare();
  store.add(sub(1));
  store.add(sub(2));
  const sent: { endpoint: string; message: PushMessage; ttl: number }[] = [];
  const lines: string[] = [];
  let now = at("2026-12-05T07:59:00Z");
  // The examples set a sentence; these tests start from the default one.
  const base = { ...readSettings("examples/content") };
  delete base.notification;
  const deps: PushDeps = {
    settings:
      options.notification === undefined
        ? base
        : { ...base, notification: options.notification },
    contentDir: content,
    store,
    send: (subscription, payload, { TTL }) => {
      const status = options.fail?.[subscription.endpoint];
      if (status !== undefined) {
        return Promise.reject(
          Object.assign(new Error("refused"), { statusCode: status }),
        );
      }
      sent.push({
        endpoint: subscription.endpoint,
        message: JSON.parse(payload) as PushMessage,
        ttl: TTL,
      });
      return Promise.resolve();
    },
    now: () => now,
    log: (line) => lines.push(line),
  };
  return {
    deps,
    store,
    sent,
    lines,
    setNow: (date: Date) => {
      now = date;
    },
  };
}

describe("sendDueDoor", () => {
  it("waits for the door to open, then sends once to every device", async () => {
    const { deps, sent, setNow, lines } = setup();
    await sendDueDoor(deps);
    expect(sent).toEqual([]);

    setNow(at("2026-12-05T08:00:00Z"));
    await sendDueDoor(deps);
    expect(sent.map((s) => s.endpoint)).toEqual([
      sub(1).endpoint,
      sub(2).endpoint,
    ]);
    expect(sent[0]?.message).toEqual({
      title: "Calendrier de l'Avent",
      body: "Door 5 is open 🎁",
      tag: "door-5",
      url: "/",
    });
    // 09:00 to midnight in Paris.
    expect(sent[0]?.ttl).toBe(15 * 3600);
    expect(lines).toEqual(["push door=5 sent=2 gone=0 failed=0"]);

    setNow(at("2026-12-05T08:01:00Z"));
    await sendDueDoor(deps);
    expect(sent).toHaveLength(2);
  });

  it("sends late the same day, never for an earlier day", async () => {
    const { deps, sent, setNow } = setup();
    setNow(at("2026-12-05T20:30:00Z"));
    await sendDueDoor(deps);
    expect(sent.map((s) => s.message.tag)).toEqual(["door-5", "door-5"]);
    expect(sent[0]?.ttl).toBe((2 * 60 + 30) * 60);

    setNow(at("2026-12-06T07:00:00Z"));
    await sendDueDoor(deps);
    expect(sent).toHaveLength(2);
  });

  it("leaves the send to the first of two servers sharing the folder", async () => {
    const first = setup();
    first.setNow(at("2026-12-05T08:00:00Z"));
    const second = { ...first.deps, store: new PushStore(first.store.dir) };
    await Promise.all([sendDueDoor(first.deps), sendDueDoor(second)]);
    expect(first.sent).toHaveLength(2);
  });

  it("sends nothing outside the calendar's days", async () => {
    const { deps, sent, setNow } = setup();
    for (const date of [
      "2026-11-30T12:00:00Z",
      "2026-12-26T12:00:00Z",
      "2027-12-05T12:00:00Z",
    ]) {
      setNow(at(date));
      await sendDueDoor(deps);
    }
    expect(sent).toEqual([]);
  });

  it("uses the calendar's sentence, and a day's own one for that day", async () => {
    const { deps, sent, setNow } = setup({
      notification: "Porte {day} : viens voir",
      days: {
        6: {
          notification: "Le jour {day} est spécial",
          blocks: [{ type: "text", text: "x" }],
        },
      },
    });
    setNow(at("2026-12-05T08:00:00Z"));
    await sendDueDoor(deps);
    setNow(at("2026-12-06T08:00:00Z"));
    await sendDueDoor(deps);
    expect(sent.map((s) => s.message.body)).toEqual([
      "Porte 5 : viens voir",
      "Porte 5 : viens voir",
      "Le jour 6 est spécial",
      "Le jour 6 est spécial",
    ]);
  });

  it("falls back to the calendar's sentence when the day's file is broken", async () => {
    const { deps, sent, setNow, lines } = setup({
      days: { 5: { nope: true } },
    });
    setNow(at("2026-12-05T08:00:00Z"));
    await sendDueDoor(deps);
    expect(sent[0]?.message.body).toBe("Door 5 is open 🎁");
    expect(lines[0]).toMatch(/^Invalid .*day\.json/);
  });

  it("forgets a device that no longer exists and keeps one that failed", async () => {
    const { deps, store, setNow, lines } = setup({
      fail: { [sub(1).endpoint]: 410, [sub(2).endpoint]: 500 },
    });
    setNow(at("2026-12-05T08:00:00Z"));
    await sendDueDoor(deps);
    expect(store.list().map((s) => s.endpoint)).toEqual([sub(2).endpoint]);
    expect(lines).toEqual([
      "push failed: status 500",
      "push door=5 sent=0 gone=1 failed=1",
    ]);
  });
});

describe("sendTest", () => {
  it("sends to a saved device only", async () => {
    const { deps, sent } = setup();
    expect(await sendTest(deps, sub(2).endpoint)).toBe("sent");
    expect(sent.map((s) => [s.endpoint, s.message.tag])).toEqual([
      [sub(2).endpoint, "test"],
    ]);
    expect(await sendTest(deps, "https://push.example/other")).toBe("unknown");
    expect(sent).toHaveLength(1);
  });

  it("forgets a device that no longer exists", async () => {
    const { deps, store } = setup({
      fail: { [sub(1).endpoint]: 404, [sub(2).endpoint]: 500 },
    });
    expect(await sendTest(deps, sub(1).endpoint)).toBe("unknown");
    expect(store.has(sub(1).endpoint)).toBe(false);
    expect(await sendTest(deps, sub(2).endpoint)).toBe("failed");
  });
});
