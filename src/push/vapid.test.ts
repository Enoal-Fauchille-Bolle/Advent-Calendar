import webpush from "web-push";
import { describe, expect, it } from "vitest";
import { vapidPublicKey } from "./vapid.ts";

describe("vapidPublicKey", () => {
  it("finds the public key of a pair made by web-push", () => {
    const pair = webpush.generateVAPIDKeys();
    expect(vapidPublicKey(pair.privateKey)).toBe(pair.publicKey);
  });

  it("refuses a malformed key", () => {
    expect(() => vapidPublicKey("short")).toThrow();
    expect(() => vapidPublicKey("A".repeat(43))).toThrow();
  });
});
