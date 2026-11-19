import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/** A browser's push subscription, as `PushSubscription.toJSON()` gives it. */
export const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}={0,2}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}={0,2}$/),
  }),
});

export interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const fileSchema = z.object({ subscriptions: z.array(subscriptionSchema) });

/** Subscriptions kept at most; the oldest go first. A few devices are expected. */
export const MAX_SUBSCRIPTIONS = 50;

/**
 * The push subscriptions, in `subscriptions.json` of the state folder, and one empty
 * marker file per day already sent, `sent-YYYY-MM-DD`.
 */
export class PushStore {
  readonly #file: string;

  constructor(readonly dir: string) {
    this.#file = join(dir, "subscriptions.json");
  }

  /** Creates the folder if needed; throws when the server cannot write in it. */
  prepare(): void {
    mkdirSync(this.dir, { recursive: true });
    const probe = join(this.dir, `.write-test-${String(process.pid)}`);
    writeFileSync(probe, "");
    unlinkSync(probe);
  }

  list(): Subscription[] {
    if (!existsSync(this.#file)) return [];
    const data: unknown = JSON.parse(readFileSync(this.#file, "utf8"));
    return fileSchema.parse(data).subscriptions.map(({ endpoint, keys }) => ({
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
    }));
  }

  has(endpoint: string): boolean {
    return this.list().some((s) => s.endpoint === endpoint);
  }

  /** Saves a subscription, or replaces the one with the same address. */
  add(subscription: Subscription): void {
    const others = this.list().filter(
      (s) => s.endpoint !== subscription.endpoint,
    );
    this.#write([...others, subscription].slice(-MAX_SUBSCRIPTIONS));
  }

  remove(endpoints: readonly string[]): void {
    if (endpoints.length === 0) return;
    const gone = new Set(endpoints);
    this.#write(this.list().filter((s) => !gone.has(s.endpoint)));
  }

  /**
   * Claims a day's send: true for the first caller only, even across two servers
   * sharing the folder, since creating a file that must not exist is atomic.
   */
  claimDay(date: string): boolean {
    try {
      closeSync(openSync(join(this.dir, `sent-${date}`), "wx"));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  }

  /** Writes a copy, then renames it over the file: a crash never leaves half a file. */
  #write(subscriptions: Subscription[]): void {
    const copy = `${this.#file}.${String(process.pid)}.tmp`;
    writeFileSync(copy, `${JSON.stringify({ subscriptions }, null, 2)}\n`);
    renameSync(copy, this.#file);
  }
}
