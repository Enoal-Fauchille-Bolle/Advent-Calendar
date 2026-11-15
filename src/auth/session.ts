/** Who is signed in: the recipient, or the author, who sees every door early. */
export type Role = "guest" | "author";

export const SESSION_COOKIE = "advent_session";
export const SESSION_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The cookie value, `<role>.<issued at, in ms>`. The cookie is signed, so it cannot be
 * edited; the date lets the server refuse it after `SESSION_DAYS` even if a browser
 * keeps it longer.
 */
export function encodeSession(role: Role, issuedAt: Date): string {
  return `${role}.${String(issuedAt.getTime())}`;
}

/** The role in a cookie value, or `null` when it is malformed or too old. */
export function decodeSession(value: string, now: Date): Role | null {
  const [role, issuedText, ...rest] = value.split(".");
  if (rest.length > 0 || (role !== "guest" && role !== "author")) return null;
  const issued = Number(issuedText);
  if (!Number.isSafeInteger(issued)) return null;
  const age = now.getTime() - issued;
  return age >= 0 && age < SESSION_DAYS * DAY_MS ? role : null;
}
