import webpush from "web-push";
import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "./config.ts";

const HASH = "scrypt:16384:8:1:c2FsdA:aGFzaA";
const base = {
  ADVENT_PASSWORD_HASH: HASH,
  ADVENT_SESSION_SECRET: "a test secret that is long enough to sign",
};

describe("readConfig", () => {
  it("turns push off without a VAPID key, and defaults the state folder", () => {
    const config = readConfig(base);
    expect(config.push).toBeUndefined();
    expect(config.stateDir).toBe("state");
  });

  it("turns push on with a key and a subject, and finds the public key", () => {
    const pair = webpush.generateVAPIDKeys();
    const config = readConfig({
      ...base,
      ADVENT_VAPID_PRIVATE_KEY: pair.privateKey,
      ADVENT_VAPID_SUBJECT: "https://advent.example",
      ADVENT_STATE_DIR: "/state",
    });
    expect(config.push).toEqual({
      privateKey: pair.privateKey,
      publicKey: pair.publicKey,
      subject: "https://advent.example",
    });
    expect(config.stateDir).toBe("/state");
  });

  it("accepts a mailto: subject", () => {
    const { privateKey } = webpush.generateVAPIDKeys();
    const config = readConfig({
      ...base,
      ADVENT_VAPID_PRIVATE_KEY: privateKey,
      ADVENT_VAPID_SUBJECT: "mailto:someone@example.com",
    });
    expect(config.push?.subject).toBe("mailto:someone@example.com");
  });

  it("refuses a key without a valid subject, and a malformed key", () => {
    const { privateKey } = webpush.generateVAPIDKeys();
    for (const subject of [
      undefined,
      "",
      "http://advent.example",
      "advent.example",
    ]) {
      expect(() =>
        readConfig({
          ...base,
          ADVENT_VAPID_PRIVATE_KEY: privateKey,
          ...(subject === undefined ? {} : { ADVENT_VAPID_SUBJECT: subject }),
        }),
      ).toThrow(/ADVENT_VAPID_SUBJECT/);
    }
    expect(() =>
      readConfig({
        ...base,
        ADVENT_VAPID_PRIVATE_KEY: "not a key",
        ADVENT_VAPID_SUBJECT: "https://advent.example",
      }),
    ).toThrow(ConfigError);
  });
});
