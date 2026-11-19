import { createECDH } from "node:crypto";

/**
 * The public half of a VAPID key pair, from its private half: both are P-256 keys in
 * URL-safe base64, as `pnpm make-vapid` prints them. Throws on a malformed key.
 */
export function vapidPublicKey(privateKey: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(privateKey)) {
    throw new Error("expected 43 characters of URL-safe base64");
  }
  const curve = createECDH("prime256v1");
  curve.setPrivateKey(Buffer.from(privateKey, "base64url"));
  return curve.getPublicKey().toString("base64url");
}
