/** Failures allowed with no wait. */
export const FREE_FAILURES = 5;

/** Wait in seconds after each further failure; the last one is the cap (15 minutes). */
export const DELAYS_SECONDS: readonly number[] = [60, 300, 900];

/**
 * Slows down password guessing. One shared password means one counter for the whole instance.
 * It lives in memory, so a restart resets it.
 *
 * A try is counted as a failure before the password is checked, so requests sent in
 * parallel cannot get more checks than one at a time would. A right password then
 * clears the count.
 */
export class LoginThrottle {
  private failures = 0;
  private blockedUntil = 0;
  private readonly now: () => number;

  /** `now` returns milliseconds; tests replace it. */
  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  /**
   * Takes a try: returns 0 and counts it when an attempt is allowed, otherwise the
   * seconds to wait, without counting anything.
   */
  take(): number {
    const wait = Math.ceil((this.blockedUntil - this.now()) / 1000);
    if (wait > 0) return wait;
    this.failures += 1;
    const step = this.failures - FREE_FAILURES;
    if (step >= 0) {
      const delay =
        DELAYS_SECONDS[Math.min(step, DELAYS_SECONDS.length - 1)] ?? 0;
      this.blockedUntil = this.now() + delay * 1000;
    }
    return 0;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.blockedUntil = 0;
  }
}
