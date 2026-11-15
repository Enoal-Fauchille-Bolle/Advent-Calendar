import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** `scrypt` cost settings. They are stored inside each hash, so they can change later. */
export interface ScryptParams {
  /** CPU and memory cost; a power of two. */
  readonly N: number;
  /** Block size. */
  readonly r: number;
  /** Parallelization. */
  readonly p: number;
}

// Minimum suggested by OWASP for scrypt (N=2^17, r=8, p=1), about 128 MiB per attempt.
export const DEFAULT_PARAMS: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };

export const PASSWORD_MAX_LENGTH = 128;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const FORMAT = "scrypt";

// Node refuses a derivation when 128 * N * r exceeds `maxmem` (32 MiB by default).
const maxmemFor = ({ N, r }: ScryptParams) => 256 * N * r;

/** Runs tasks one after another, in the order they arrive; a failed task does not stop the next. */
export class OneAtATime {
  private last: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.last.then(task);
    this.last = result.catch(() => undefined);
    return result;
  }
}

// One derivation at a time keeps the memory to one block (about 128 MiB with the default
// settings). The login throttle bounds the line, so a visitor waits a few checks at most.
const derivations = new OneAtATime();

function derive(
  password: string,
  salt: Buffer,
  keyBytes: number,
  params: ScryptParams,
): Promise<Buffer> {
  return derivations.run(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(
          password.normalize("NFKC"),
          salt,
          keyBytes,
          { ...params, maxmem: maxmemFor(params) },
          (error, key) => {
            if (error) reject(error);
            else resolve(key);
          },
        );
      }),
  );
}

/**
 * Returns `scrypt:N:r:p:salt:key` (salt and key in base64), ready to store. The colon
 * keeps the hash safe in `.env` files and shells, where `$` would start a variable.
 */
export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, params);
  const { N, r, p } = params;
  return [
    FORMAT,
    N,
    r,
    p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join(":");
}

/** Checks a password against a stored hash; a malformed hash never matches. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== FORMAT) return false;
  const [, n, r, p, saltText, keyText] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  const salt = Buffer.from(saltText, "base64");
  const expected = Buffer.from(keyText, "base64");
  if (expected.length === 0 || salt.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await derive(password, salt, expected.length, params);
  } catch {
    // Invalid parameters in the stored string.
    return false;
  }
  return timingSafeEqual(actual, expected);
}
