import { raw } from "hono/html";
import type { Role } from "../auth/session.ts";
import { doorAnimation, type DoorSize, type Settings } from "../settings.ts";
import { strings } from "../strings.ts";
import { calendarDays, isUnlocked } from "../unlock.ts";
import { Layout } from "./layout.tsx";

/** Number of door patterns in the stylesheet (`.door--p0` to `.door--p5`). */
const PATTERNS = 6;

/** A bell, for the notifications button. */
const BELL = ["M6 16V11a6 6 0 0 1 12 0v5l2 2H4z", "M10 20a2 2 0 0 0 4 0"];
/** A paper plane, for the author's test notification. */
const PLANE = ["M21 3 3 10.5l7 2.5 2.5 7z", "M21 3 10 13"];
/** A door with an arrow going out, for the logout button. */
const DOOR_OUT = [
  "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4",
  "M10 16l-4-4 4-4",
  "M6 12h10",
];

/** A line icon drawn in the text colour; the button's text names it. */
function Icon({ paths }: { paths: readonly string[] }) {
  return (
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths.map((d) => (
        <path d={d} />
      ))}
    </svg>
  );
}

export function CalendarPage({
  settings,
  role,
  now,
  sizes,
  vapidKey,
}: {
  settings: Settings;
  role: Role;
  now: Date;
  /** The tile size of each door; a door missing from it is small. */
  sizes: ReadonlyMap<number, DoorSize>;
  /** The VAPID public key; absent when push is off, which leaves out the bell. */
  vapidKey?: string | undefined;
}) {
  // `<` cannot close the script element once escaped.
  const clientStrings = JSON.stringify(strings.client).replaceAll(
    "<",
    "\\u003c",
  );
  return (
    <Layout title={settings.title}>
      {settings.banner === "" ? null : (
        <div class="banner" aria-label={settings.banner}>
          <p class="banner-track" aria-hidden="true">
            <span>{settings.banner}</span>
            <span>{settings.banner}</span>
          </p>
        </div>
      )}
      <header class="site-header">
        <div class="header-bar">
          <time
            class="header-date"
            datetime={strings.isoDate(now, settings.timezone)}
          >
            {strings.shortDate(now, settings.timezone)}
          </time>
          {role === "author" ? (
            <span class="author-badge">
              <span aria-hidden="true">{strings.calendar.authorBadge}</span>
              <span class="visually-hidden">{strings.calendar.authorMode}</span>
            </span>
          ) : null}
          {vapidKey === undefined ? null : (
            <>
              {/* Hidden until the browser script finds that notifications can be asked. */}
              <button
                type="button"
                class="notify"
                data-vapid-key={vapidKey}
                hidden
              >
                <Icon paths={BELL} />
                <span class="header-label">
                  {strings.calendar.notifications}
                </span>
              </button>
              {/* In the bell's place once notifications are allowed. */}
              {role === "author" ? (
                <button
                  type="button"
                  class="notify notify-test"
                  title={strings.calendar.notificationTest}
                  hidden
                >
                  <Icon paths={PLANE} />
                  <span class="header-label">
                    {strings.calendar.notificationTest}
                  </span>
                </button>
              ) : null}
            </>
          )}
          <form method="post" action="/logout" class="logout">
            <button type="submit">
              <Icon paths={DOOR_OUT} />
              {/* In author mode the badge takes room: phones get the icon alone. */}
              <span class={role === "author" ? "header-label" : undefined}>
                {strings.calendar.logout}
              </span>
            </button>
          </form>
        </div>
        <h1 class="header-title">{settings.title}</h1>
      </header>
      <main class="calendar">
        <div class="doors">
          {calendarDays(settings).map((day) => {
            const open = isUnlocked(day, settings, now);
            return (
              <button
                type="button"
                class={`door door--${sizes.get(day) ?? "small"} door--p${String((day * 5) % PATTERNS)}`}
                data-day={String(day)}
                data-animation={doorAnimation(settings, day)}
                data-state={open || role === "author" ? "open" : "locked"}
                data-unlocks={strings.unlocksOn(
                  day,
                  settings.month,
                  settings.year,
                  settings.unlockTime,
                )}
                aria-label={strings.calendar.door(day)}
              >
                <span class="door-number">{day}</span>
              </button>
            );
          })}
        </div>
      </main>
      {/* closedby="any": a tap outside the dialog closes it too ("light dismiss"). */}
      <dialog id="day-dialog" class="day-dialog" closedby="any">
        {/* Focus starts here, at the top: by default it goes to the first control,
            the player or the close button, and a tall day would open scrolled down. */}
        <div
          class="day-content"
          aria-live="polite"
          tabindex={-1}
          autofocus
        ></div>
        <form method="dialog">
          <button type="submit">{strings.calendar.close}</button>
        </form>
      </dialog>
      <script type="application/json" id="client-strings">
        {raw(clientStrings)}
      </script>
      <script type="module" src="/static/doors.js"></script>
    </Layout>
  );
}
