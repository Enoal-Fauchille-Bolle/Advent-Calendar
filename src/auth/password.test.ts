import { describe, expect, it } from "vitest";
import { OneAtATime, hashPassword, verifyPassword } from "./password.ts";

// Cheap settings: the real ones take about 100 ms and 128 MiB per call.
const FAST = { N: 2 ** 10, r: 8, p: 1 };

describe("hashPassword", () => {
  it("stores the settings with the hash", async () => {
    const hash = await hashPassword("correct horse", FAST);
    expect(hash.split(":").slice(0, 4)).toEqual(["scrypt", "1024", "8", "1"]);
  });

  it("gives a different hash each time for the same password", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same", FAST),
      hashPassword("same", FAST),
    ]);
    expect(a).not.toBe(b);
  });

  it("works with the default settings", async () => {
    const hash = await hashPassword("default settings");
    expect(await verifyPassword("default settings", hash)).toBe(true);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password and refuses another", async () => {
    const hash = await hashPassword("correct horse", FAST);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("Correct horse", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("treats visually identical Unicode forms as the same password", async () => {
    const hash = await hashPassword("café", FAST);
    expect(await verifyPassword("café", hash)).toBe(true);
  });

  it.each([
    "",
    "plain text",
    "scrypt:1024:8:1:c2FsdA==",
    "bcrypt:1024:8:1:c2FsdA==:a2V5",
    "scrypt:1000:8:1:c2FsdA==:a2V5",
    "scrypt:1024:8:1::a2V5",
    "scrypt:1024:8:1:c2FsdA==:",
  ])("never matches the malformed hash %j", async (stored) => {
    expect(await verifyPassword("anything", stored)).toBe(false);
  });
});

describe("OneAtATime", () => {
  /** A task that records when it starts and ends, and finishes when told. */
  function task(log: string[], name: string, fail = false) {
    let finish = () => {};
    const run = () =>
      new Promise<string>((resolve, reject) => {
        log.push(`${name} start`);
        finish = () => {
          log.push(`${name} end`);
          if (fail) reject(new Error(name));
          else resolve(name);
        };
      });
    return {
      run,
      finish: () => {
        finish();
      },
    };
  }

  it("starts a task only once the previous one has ended", async () => {
    const line = new OneAtATime();
    const log: string[] = [];
    const a = task(log, "a");
    const b = task(log, "b");
    const first = line.run(a.run);
    const second = line.run(b.run);
    await Promise.resolve();
    expect(log).toEqual(["a start"]);
    a.finish();
    expect(await first).toBe("a");
    await Promise.resolve();
    expect(log).toEqual(["a start", "a end", "b start"]);
    b.finish();
    expect(await second).toBe("b");
  });

  it("runs the next task after one that failed", async () => {
    const line = new OneAtATime();
    const log: string[] = [];
    const a = task(log, "a", true);
    const b = task(log, "b");
    const first = line.run(a.run);
    const second = line.run(b.run);
    await Promise.resolve();
    a.finish();
    await expect(first).rejects.toThrow("a");
    await Promise.resolve();
    b.finish();
    expect(await second).toBe("b");
    expect(log).toEqual(["a start", "a end", "b start", "b end"]);
  });
});
