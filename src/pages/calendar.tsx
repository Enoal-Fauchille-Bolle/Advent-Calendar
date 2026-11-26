import { raw } from "hono/html";
import type { Role } from "../auth/session.ts";
import { isoDate, type Strings, translation } from "../i18n/index.ts";
import { doorAnimation, type DoorSize, type Settings } from "../settings.ts";
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

/**
 * The author's toolbar: viewing tools, run in this browser only. Nothing it does
 * changes the content or what visitors see.
 */
function AuthorTools({ t }: { t: Strings }) {
  return (
    <section class="author-tools" aria-label={t.tools.label}>
      <div class="tools-row">
        <button type="button" data-tool="open-all">
          {t.tools.openAll}
        </button>
        <button type="button" data-tool="close-all">
          {t.tools.closeAll}
        </button>
        <label class="tool-switch">
          {/* autocomplete off: a reload starts with the switch off, as the view does. */}
          <input type="checkbox" data-tool="visitor-view" autocomplete="off" />
          {t.tools.visitorView}
        </label>
        <label class="tool-switch">
          <input type="checkbox" data-tool="unlock-dates" autocomplete="off" />
          {t.tools.unlockDates}
        </label>
        <button type="button" data-tool="check">
          {t.tools.check}
        </button>
      </div>
      <div class="tools-result" role="status" hidden></div>
    </section>
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
  const t = translation(settings.language);
  // `<` cannot close the script element once escaped.
  const clientStrings = JSON.stringify(t.client).replaceAll("<", "\\u003c");
  return (
    <Layout title={settings.title} lang={t.lang}>
      {settings.banner === "" ? null : (
        <div
          class="banner"
          aria-label={settings.banner}
          data-speed={String(settings.bannerSpeed)}
        >
          <p class="banner-track" aria-hidden="true">
            <span>{settings.banner}</span>
            <span>{settings.banner}</span>
          </p>
        </div>
      )}
      <header class="site-header">
        <div class="header-bar">
          <time class="header-date" datetime={isoDate(now, settings.timezone)}>
            {t.shortDate(now, settings.timezone)}
          </time>
          {role === "author" ? (
            <span class="author-badge">
              <span aria-hidden="true">{t.calendar.authorBadge}</span>
              <span class="visually-hidden">{t.calendar.authorMode}</span>
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
                <span class="header-label">{t.calendar.notifications}</span>
              </button>
              {/* In the bell's place once notifications are allowed. */}
              {role === "author" ? (
                <button
                  type="button"
                  class="notify notify-test"
                  title={t.calendar.notificationTest}
                  hidden
                >
                  <Icon paths={PLANE} />
                  <span class="header-label">
                    {t.calendar.notificationTest}
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
                {t.calendar.logout}
              </span>
            </button>
          </form>
        </div>
        <h1 class="header-title">{settings.title}</h1>
      </header>
      {role === "author" ? <AuthorTools t={t} /> : null}
      <main class="calendar">
        <div class="doors">
          {calendarDays(settings).map((day) => {
            const open = isUnlocked(day, settings, now);
            const author = role === "author";
            return (
              <button
                type="button"
                class={`door door--${sizes.get(day) ?? "small"} door--p${String((day * 5) % PATTERNS)}`}
                data-day={String(day)}
                data-animation={doorAnimation(settings, day)}
                data-state={open || author ? "open" : "locked"}
                // Whether a visitor may open it now: the toolbar's visitor view.
                data-unlocked={author ? String(open) : undefined}
                data-unlocks={t.unlocksOn(
                  day,
                  settings.month,
                  settings.year,
                  settings.unlockTime,
                )}
                aria-label={t.calendar.door(day)}
              >
                <span class="door-number">{day}</span>
                {author ? (
                  <span class="door-date" aria-hidden="true">
                    {t.doorDate(
                      day,
                      settings.month,
                      settings.year,
                      settings.unlockTime,
                    )}
                  </span>
                ) : null}
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
          <button type="submit">{t.calendar.close}</button>
        </form>
      </dialog>
      <script type="application/json" id="client-strings">
        {raw(clientStrings)}
      </script>
      <script type="module" src="/static/doors.js"></script>
    </Layout>
  );
}
