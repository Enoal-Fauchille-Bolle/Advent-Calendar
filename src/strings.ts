/** Every French text of the interface, in one place so another language can follow. */
export const strings = {
  lang: "fr",
  login: {
    title: "Entre le mot de passe",
    password: "Mot de passe", // betterleaks:allow (a field label)
    submit: "Ouvrir le calendrier",
    wrong: "Ce n'est pas le bon mot de passe.",
    tooMany: (seconds: number) =>
      `Trop d'essais. Réessaie dans ${String(Math.ceil(seconds / 60))} min.`,
  },
  calendar: {
    door: (day: number) => `Porte ${String(day)}`,
    authorBadge: "Auteur",
    authorMode:
      "Mode auteur : toutes les portes s'ouvrent, même avant leur date.",
    notifications: "Notifications",
    notificationTest: "Notification de test",
    logout: "Se déconnecter",
    close: "Fermer",
  },
  /** Texts the browser script shows, sent to it with the page. */
  client: {
    loading: "Ouverture…",
    locked: "Patience, cette porte s'ouvre",
    empty: "Cette porte est encore vide.",
    error: "La porte est coincée. Réessaie dans un instant.",
    voucher: "Bon pour",
    notificationsBlocked:
      "Les notifications sont bloquées pour ce site. Pour les activer, ouvre les réglages du site dans ton navigateur (souvent l'icône à gauche de l'adresse), autorise les notifications, puis recharge la page.",
    testSent: "Notification envoyée : elle arrive dans quelques secondes.",
    testUnknown:
      "Cet appareil n'est pas enregistré pour les notifications. Recharge la page puis réessaie.",
    testFailed: "L'envoi a échoué. Réessaie dans un instant.",
  },
  /** Texts of the notifications. */
  push: {
    /** The door's notification when `calendar.json` gives none; `{day}` is its number. */
    door: "La porte {day} est ouverte 🎁",
    test: "Les notifications marchent 🎉",
  },
  /** "Mer. 2 déc.": today's date in the calendar's time zone, for the header. */
  shortDate: (now: Date, timeZone: string) => {
    const date = new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone,
    }).format(now);
    return date.charAt(0).toUpperCase() + date.slice(1);
  },
  /** "2026-12-02": the same date, for the `datetime` attribute. */
  isoDate: (now: Date, timeZone: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(now),
  /** "le 7 décembre à 09:00" */
  unlocksOn: (day: number, month: number, year: number, time: string) => {
    const date = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
    return `le ${date} à ${time}`;
  },
} as const;

export type ClientStrings = typeof strings.client;
