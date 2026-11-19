import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_SUBSCRIPTIONS, PushStore } from "./store.ts";

const sub = (n: number) => ({
  endpoint: `https://push.example/${String(n)}`,
  keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
});

function store(): PushStore {
  const s = new PushStore(join(mkdtempSync(join(tmpdir(), "push-")), "state"));
  s.prepare();
  return s;
}

describe("PushStore", () => {
  it("starts empty and creates its folder", () => {
    const s = store();
    expect(s.list()).toEqual([]);
    expect(readdirSync(s.dir)).toEqual([]);
  });

  it("adds, replaces by address, and removes subscriptions", () => {
    const s = store();
    s.add(sub(1));
    s.add(sub(2));
    s.add({
      ...sub(1),
      keys: { p256dh: "C".repeat(87), auth: "D".repeat(22) },
    });
    expect(s.list().map((x) => x.endpoint)).toEqual([
      sub(2).endpoint,
      sub(1).endpoint,
    ]);
    expect(s.list()[1]?.keys.auth).toBe("D".repeat(22));
    expect(s.has(sub(2).endpoint)).toBe(true);
    s.remove([sub(2).endpoint]);
    expect(s.list()).toEqual([
      {
        endpoint: sub(1).endpoint,
        keys: { p256dh: "C".repeat(87), auth: "D".repeat(22) },
      },
    ]);
  });

  it("keeps the newest subscriptions only", () => {
    const s = store();
    for (let n = 0; n <= MAX_SUBSCRIPTIONS; n += 1) s.add(sub(n));
    const kept = s.list();
    expect(kept).toHaveLength(MAX_SUBSCRIPTIONS);
    expect(kept[0]?.endpoint).toBe(sub(1).endpoint);
  });

  it("writes plain JSON and leaves no temporary file", () => {
    const s = store();
    s.add(sub(1));
    expect(readdirSync(s.dir)).toEqual(["subscriptions.json"]);
    expect(
      JSON.parse(readFileSync(join(s.dir, "subscriptions.json"), "utf8")),
    ).toEqual({
      subscriptions: [sub(1)],
    });
  });

  it("lets one caller only claim a day, even from a second store on the folder", () => {
    const s = store();
    const other = new PushStore(s.dir);
    expect(s.claimDay("2026-12-05")).toBe(true);
    expect(other.claimDay("2026-12-05")).toBe(false);
    expect(s.claimDay("2026-12-05")).toBe(false);
    expect(other.claimDay("2026-12-06")).toBe(true);
  });
});
