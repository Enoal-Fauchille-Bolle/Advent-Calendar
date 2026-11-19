// Prints a new VAPID private key, for ADVENT_VAPID_PRIVATE_KEY; the server computes the
// public key from it. A new key makes every saved subscription useless: each browser
// subscribes again at its next visit.
// Usage: pnpm make-vapid
import webpush from "web-push";

console.log(webpush.generateVAPIDKeys().privateKey);
