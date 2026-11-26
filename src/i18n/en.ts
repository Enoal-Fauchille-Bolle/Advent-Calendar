import { formatDay, minutes, type Strings } from "./types.ts";

export const en: Strings = {
  lang: "en",
  login: {
    password: "Password", // betterleaks:allow (a field label)
    submit: "Open the calendar",
    wrong: "That is not the right password.",
    tooMany: (seconds) =>
      `Too many tries. Try again in ${minutes(seconds)} min.`,
  },
  calendar: {
    door: (day) => `Door ${String(day)}`,
    authorBadge: "Author",
    authorMode: "Author mode: every door opens, even before its date.",
    notifications: "Notifications",
    notificationTest: "Test notification",
    logout: "Log out",
    close: "Close",
  },
  client: {
    loading: "Opening…",
    locked: "Patience, this door opens",
    empty: "This door is still empty.",
    error: "The door is stuck. Try again in a moment.",
    voucher: "Good for",
    notificationsBlocked:
      "Notifications are blocked for this site. To turn them on, open the site settings in your browser (often the icon left of the address), allow notifications, then reload the page.",
    testSent: "Notification sent: it arrives in a few seconds.",
    testUnknown:
      "This device is not registered for notifications. Reload the page, then try again.",
    testFailed: "Sending failed. Try again in a moment.",
  },
  share: {
    title: "Advent calendar",
    description: "A surprise behind each door, until Christmas",
  },
  push: {
    door: "Door {day} is open 🎁",
    test: "Notifications work 🎉",
  },
  /** "Wed 2 Dec" */
  shortDate: (now, timeZone) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone,
    }).format(now),
  /** "on 7 December at 09:00" */
  unlocksOn: (day, month, year, time) =>
    `on ${formatDay("en-GB", day, month, year, { day: "numeric", month: "long" })} at ${time}`,
};
