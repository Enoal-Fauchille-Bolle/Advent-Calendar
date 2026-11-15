import { raw } from "hono/html";
import type { Role } from "../auth/session.ts";
import type { Settings } from "../settings.ts";
import { strings } from "../strings.ts";
import { calendarDays, isUnlocked } from "../unlock.ts";
import { Layout } from "./layout.tsx";

/** Number of door patterns in the stylesheet (`.door--p0` to `.door--p5`). */
const PATTERNS = 6;

export function CalendarPage({
  settings,
  role,
  now,
}: {
  settings: Settings;
  role: Role;
  now: Date;
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
      <main class="calendar">
        <h1 class="visually-hidden">{settings.title}</h1>
        {role === "author" ? (
          <p class="author-note">{strings.calendar.authorMode}</p>
        ) : null}
        <div class="doors">
          {calendarDays(settings).map((day) => {
            const open = isUnlocked(day, settings, now);
            return (
              <button
                type="button"
                class={`door door--p${String((day * 5) % PATTERNS)}`}
                data-day={String(day)}
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
        <form method="post" action="/logout" class="logout">
          <button type="submit">{strings.calendar.logout}</button>
        </form>
      </main>
      <dialog id="day-dialog" class="day-dialog">
        <div class="day-content" aria-live="polite"></div>
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
