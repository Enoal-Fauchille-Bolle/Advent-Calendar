import { vapidPublicKey } from "./push/vapid.ts";

export class ConfigError extends Error {}

/** What web push needs; absent when no VAPID key is set, which turns push off. */
export interface PushConfig {
  privateKey: string;
  /** Computed from the private key. */
  publicKey: string;
  /** A contact for the push services: an `https:` URL or a `mailto:` address. */
  subject: string;
}

export interface Config {
  host: string;
  port: number;
  contentDir: string;
  /** A folder the server may write: push subscriptions and the days already sent. */
  stateDir: string;
  push: PushConfig | undefined;
  /** Hash of the shared password, from `pnpm make-hash`. */
  passwordHash: string;
  /** Hash of the author password, which opens every door early; optional. */
  authorPasswordHash: string | undefined;
  /** Key that signs the login cookie; changing it logs everyone out. */
  sessionSecret: string;
  /**
   * The site's address as visitors type it, such as `https://advent.example`, without
   * a final slash; optional. A shared link's card shows a picture only with it.
   */
  publicUrl: string | undefined;
}

/** A public URL without its final slashes, or `undefined` when it is not http(s). */
function publicAddress(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (url.search !== "" || url.hash !== "") return undefined;
    return url.href.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

const SESSION_SECRET_MIN_LENGTH = 32;

function isHash(value: string): boolean {
  return value.startsWith("scrypt:") && value.split(":").length === 6;
}

/** Reads the configuration from environment variables. */
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const problems: string[] = [];

  const portText = env.ADVENT_PORT ?? "3000";
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`ADVENT_PORT must be a port number, got "${portText}"`);
  }

  const passwordHash = env.ADVENT_PASSWORD_HASH ?? "";
  if (!isHash(passwordHash)) {
    problems.push(
      "ADVENT_PASSWORD_HASH must be set to the output of `pnpm make-hash`",
    );
  }

  const author = env.ADVENT_AUTHOR_PASSWORD_HASH;
  const authorPasswordHash =
    author === undefined || author === "" ? undefined : author;
  if (authorPasswordHash !== undefined && !isHash(authorPasswordHash)) {
    problems.push(
      "ADVENT_AUTHOR_PASSWORD_HASH must be empty or the output of `pnpm make-hash`",
    );
  }
  if (authorPasswordHash !== undefined && authorPasswordHash === passwordHash) {
    problems.push(
      "ADVENT_AUTHOR_PASSWORD_HASH must differ from ADVENT_PASSWORD_HASH",
    );
  }

  const sessionSecret = env.ADVENT_SESSION_SECRET ?? "";
  if (sessionSecret.length < SESSION_SECRET_MIN_LENGTH) {
    problems.push(
      `ADVENT_SESSION_SECRET must hold at least ${String(SESSION_SECRET_MIN_LENGTH)} characters (for example \`openssl rand -base64 48\`)`,
    );
  }

  // No private key, no push: the bell stays hidden and nothing is sent.
  let push: PushConfig | undefined;
  const privateKey = env.ADVENT_VAPID_PRIVATE_KEY ?? "";
  if (privateKey !== "") {
    let publicKey = "";
    try {
      publicKey = vapidPublicKey(privateKey);
    } catch {
      problems.push(
        "ADVENT_VAPID_PRIVATE_KEY must be empty or the output of `pnpm make-vapid`",
      );
    }
    const subject = env.ADVENT_VAPID_SUBJECT ?? "";
    if (!/^(https:\/\/[^/\s]+|mailto:\S+@\S+)/.test(subject)) {
      problems.push(
        "ADVENT_VAPID_SUBJECT must be the site's https:// URL or a mailto: address when ADVENT_VAPID_PRIVATE_KEY is set",
      );
    }
    push = { privateKey, publicKey, subject };
  }

  const publicText = env.ADVENT_PUBLIC_URL ?? "";
  const publicUrl = publicText === "" ? undefined : publicAddress(publicText);
  if (publicText !== "" && publicUrl === undefined) {
    problems.push(
      `ADVENT_PUBLIC_URL must be empty or the site's http(s):// address, got "${publicText}"`,
    );
  }

  if (problems.length > 0) {
    throw new ConfigError(`Invalid configuration:\n- ${problems.join("\n- ")}`);
  }

  return {
    host: env.ADVENT_HOST ?? "127.0.0.1",
    port,
    contentDir: env.ADVENT_CONTENT_DIR ?? "content",
    stateDir: env.ADVENT_STATE_DIR ?? "state",
    push,
    passwordHash,
    authorPasswordHash,
    sessionSecret,
    publicUrl,
  };
}
