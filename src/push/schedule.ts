import { DayError, dayNotification } from "../days.ts";
import type { Settings } from "../settings.ts";
import { translation } from "../i18n/index.ts";
import { isUnlocked, localDateTime } from "../unlock.ts";
import type { PushStore, Subscription } from "./store.ts";

/** What a notification carries to the service worker, `src/sw/sw.ts`. */
export interface PushMessage {
  title: string;
  body: string;
  /** A second notification with the same tag replaces the first. */
  tag: string;
  url: string;
}

export interface SendOptions {
  /** Seconds the push service keeps the message for a phone that is offline. */
  TTL: number;
  urgency: "high";
}

/** Sends one message; a push service refusal throws an error with `statusCode`. */
export type Send = (
  subscription: Subscription,
  payload: string,
  options: SendOptions,
) => Promise<void>;

export interface PushDeps {
  settings: Settings;
  contentDir: string;
  store: PushStore;
  send: Send;
  now: () => Date;
  log: (line: string) => void;
}

/** The push service answers 404 or 410 for a subscription that no longer exists. */
function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return status === 404 || status === 410;
}

function reason(error: unknown): string {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === "number") return `status ${String(status)}`;
  return error instanceof Error ? error.message : String(error);
}

/** A day's notification: its own sentence, or the calendar's, or the default one. */
function doorText(deps: PushDeps, day: number): string {
  let own: string | null = null;
  try {
    own = dayNotification(deps.contentDir, day);
  } catch (error) {
    if (!(error instanceof DayError)) throw error;
    deps.log(error.message);
  }
  const text =
    own ??
    deps.settings.notification ??
    translation(deps.settings.language).push.door;
  return text.replaceAll("{day}", String(day));
}

/**
 * Seconds left until midnight, local time: a message for a phone that comes back
 * online later still arrives the same day, never the next one.
 */
function secondsLeftToday(localTime: string): number {
  const [hours = 0, minutes = 0] = localTime.split(":").map(Number);
  return Math.max(60, (24 * 60 - (hours * 60 + minutes)) * 60);
}

/** Sends a message to each subscription and forgets those that no longer exist. */
async function sendToAll(
  deps: PushDeps,
  message: PushMessage,
  options: SendOptions,
): Promise<{ sent: number; gone: number; failed: number }> {
  const payload = JSON.stringify(message);
  const gone: string[] = [];
  let sent = 0;
  let failed = 0;
  for (const subscription of deps.store.list()) {
    try {
      await deps.send(subscription, payload, options);
      sent += 1;
    } catch (error) {
      if (isGone(error)) gone.push(subscription.endpoint);
      else {
        failed += 1;
        deps.log(`push failed: ${reason(error)}`);
      }
    }
  }
  deps.store.remove(gone);
  return { sent, gone: gone.length, failed };
}

/**
 * Sends today's door when it is open and nobody sent it yet. A day missed while the
 * server was down goes out late the same day, never on a later one.
 */
export async function sendDueDoor(deps: PushDeps): Promise<void> {
  const { settings } = deps;
  const now = deps.now();
  const local = localDateTime(now, settings.timezone);
  const date = local.slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);
  if (year !== settings.year || month !== settings.month || day === undefined) {
    return;
  }
  if (!isUnlocked(day, settings, now)) return;
  if (!deps.store.claimDay(date)) return;

  const result = await sendToAll(
    deps,
    {
      title: settings.title,
      body: doorText(deps, day),
      tag: `door-${String(day)}`,
      url: "/",
    },
    { TTL: secondsLeftToday(local.slice(11)), urgency: "high" },
  );
  deps.log(
    `push door=${String(day)} sent=${String(result.sent)} gone=${String(result.gone)} failed=${String(result.failed)}`,
  );
}

export type TestResult = "sent" | "unknown" | "failed";

/** Sends the test notification to one saved subscription. */
export async function sendTest(
  deps: PushDeps,
  endpoint: string,
): Promise<TestResult> {
  const subscription = deps.store.list().find((s) => s.endpoint === endpoint);
  if (subscription === undefined) return "unknown";
  const message: PushMessage = {
    title: deps.settings.title,
    body: translation(deps.settings.language).push.test,
    tag: "test",
    url: "/",
  };
  try {
    await deps.send(subscription, JSON.stringify(message), {
      TTL: 60,
      urgency: "high",
    });
    return "sent";
  } catch (error) {
    if (isGone(error)) {
      deps.store.remove([endpoint]);
      return "unknown";
    }
    deps.log(`push test failed: ${reason(error)}`);
    return "failed";
  }
}

/** Checks once at start, then every minute; returns a function that stops it. */
export function startDoorSchedule(
  deps: PushDeps,
  everyMs = 60_000,
): () => void {
  let running = false;
  const check = () => {
    if (running) return;
    running = true;
    sendDueDoor(deps)
      .catch((error: unknown) => {
        deps.log(`push check failed: ${reason(error)}`);
      })
      .finally(() => {
        running = false;
      });
  };
  check();
  const timer = setInterval(check, everyMs);
  return () => {
    clearInterval(timer);
  };
}
