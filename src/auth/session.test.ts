import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, SESSION_DAYS } from "./session.ts";

const issued = new Date("2026-12-01T08:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("session values", () => {
  it("round-trips a role", () => {
    expect(decodeSession(encodeSession("guest", issued), issued)).toBe("guest");
    expect(decodeSession(encodeSession("author", issued), issued)).toBe(
      "author",
    );
  });

  it("expires after the session lifetime", () => {
    const value = encodeSession("guest", issued);
    const justBefore = new Date(issued.getTime() + SESSION_DAYS * DAY_MS - 1);
    const atLimit = new Date(issued.getTime() + SESSION_DAYS * DAY_MS);
    expect(decodeSession(value, justBefore)).toBe("guest");
    expect(decodeSession(value, atLimit)).toBeNull();
  });

  it.each(["admin.1", "guest", "guest.abc", "guest.1.2", ""])(
    "refuses %j",
    (value) => {
      expect(decodeSession(value, issued)).toBeNull();
    },
  );
});
