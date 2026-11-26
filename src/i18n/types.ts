/** Every text of the interface in one language: one file per language implements it. */
export interface Strings {
  /** The `lang` attribute of the page, such as `en`. */
  lang: string;
  login: {
    password: string;
    submit: string;
    wrong: string;
    tooMany: (seconds: number) => string;
  };
  calendar: {
    door: (day: number) => string;
    authorBadge: string;
    authorMode: string;
    notifications: string;
    notificationTest: string;
    logout: string;
    close: string;
  };
  /** Texts the browser script shows, sent to it with the page. */
  client: {
    loading: string;
    locked: string;
    empty: string;
    error: string;
    voucher: string;
    notificationsBlocked: string;
    testSent: string;
    testUnknown: string;
    testFailed: string;
  };
  /** The card a messaging app shows for a shared link, from the login page. */
  share: {
    title: string;
    description: string;
  };
  /** Texts of the notifications. */
  push: {
    /** The door's notification when `calendar.json` gives none; `{day}` is its number. */
    door: string;
    test: string;
  };
  /** Today's date in the calendar's time zone, short, for the header. */
  shortDate: (now: Date, timeZone: string) => string;
  /** When a locked door opens, to follow `client.locked`. */
  unlocksOn: (day: number, month: number, year: number, time: string) => string;
}

/** The minutes left before the next try, rounded up. */
export function minutes(seconds: number): string {
  return String(Math.ceil(seconds / 60));
}

/** A day of the calendar's month, formatted in a locale; the date has no time zone. */
export function formatDay(
  locale: string,
  day: number,
  month: number,
  year: number,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
